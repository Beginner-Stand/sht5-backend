import os
import json
from deepface import DeepFace
from util import prep_image
import time
from decimal import Decimal
import json

import boto3
dynamodb = boto3.resource('dynamodb')

os.environ['CUDA_VISIBLE_DEVICES'] = "-1"

TEMPLATE_IMAGE = os.environ['TEMPLATE_IMAGE']

BACKENDS = ['opencv', 'ssd', 'dlib', 'mtcnn', 'retinaface']
MODELS = ["VGG-Face", "Facenet", "Facenet512",
          "OpenFace", "DeepFace", "DeepID", "ArcFace", "Dlib"]


def verify(event, context):
    uploaded_image = prep_image(event['detail']['url'], event['detail']['ext'])
    template_image = prep_image(TEMPLATE_IMAGE)
    obj = DeepFace.verify(template_image, uploaded_image,
                          detector_backend=BACKENDS[4], model_name=MODELS[-2], distance_metric='cosine')
    body = {
        "message": obj,
        "input": event,
    }
    timestamp = str(time.time())
    table = dynamodb.Table('sht5-table')
    item = obj.copy()
    item_id = event['detail']['id']
    item.update({
        'id': item_id,
        'PK': item_id,
        'createdAt': timestamp,
        'updatedAt': timestamp,
    })
    decimal_item = json.loads(json.dumps(item), parse_float=Decimal)
    table.put_item(Item=decimal_item)
    response = {"statusCode": 200, "body": json.dumps(body)}
    return response
