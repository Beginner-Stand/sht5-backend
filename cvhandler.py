import os
import json
import cv2 as cv
import numpy as np
import time
from decimal import Decimal
from util import prep_image

import boto3
dynamodb = boto3.resource('dynamodb')

os.environ['CUDA_VISIBLE_DEVICES'] = "-1"


def dist(vec1, vec2):
    return np.linalg.norm(vec1-vec2)


def avg(flat_im):
    return (np.sum(flat_im, axis=0)+np.array([1, 1, 1])) / (len(flat_im)+1)


def iterate(im, means):
    buckets = [[] for _ in range(len(means))]
    for v in im:
        dists = [dist(v, mean) for mean in means]
        buckets[np.argmin(dists)].append(v)
    for i in range(len(means)):
        means[i] = avg(buckets[i])


def extractcolor(event, context):
    uploaded_image = prep_image(event['detail']['url'], event['detail']['ext'])
    im = cv.imread(uploaded_image)
    if event['detail']['ext'].lower() == 'jpg' or event['detail']['ext'].lower() == 'jpeg':
        im = cv.cvtColor(im, cv.COLOR_BGR2RGB)
    if len(im) > 150 or len(im[0]) > 150:
        # Compress if too large
        im = cv.resize(im, (min((150, len(im))), min((150, len(im[0])))))
    # Flatten to process
    flatten_im = np.vectorize(int)(im.reshape(-1, im.shape[-1]))
    # Randomized initial means
    means = [np.array([float(d)*256 for d in v], dtype=float)
             for v in np.random.rand(7, 3)]
    for _ in range(5):
        # Repeat the iterations
        iterate(flatten_im, means)
    buckets = [[] for _ in range(len(means))]
    for v in flatten_im:
        dists = [dist(v, mean) for mean in means]
        buckets[np.argmin(dists)].append(v)
    buckets.sort(key=len, reverse=True)
    rel_pixels = [v for bucket in buckets[:3] for v in bucket]
    adjusted_mean = np.vectorize(np.uint8)(avg(rel_pixels))
    mean_r = int(adjusted_mean[0])
    mean_g = int(adjusted_mean[1])
    mean_b = int(adjusted_mean[2])
    item = {"mean_r": mean_r, "mean_g": mean_g, "mean_b": mean_b}
    timestamp = str(time.time())
    table = dynamodb.Table('sht5-table')
    item_id = event['detail']['id']
    item.update({
        'id': item_id,
        'PK': item_id,
        'createdAt': timestamp,
        'updatedAt': timestamp,
    })
    decimal_item = json.loads(json.dumps(item), parse_float=Decimal)
    table.put_item(Item=decimal_item)
    return {"statusCode": 200, "body": json.dumps(item)}
