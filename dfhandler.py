import os
import json
from deepface import DeepFace
import urllib.request
import uuid

os.environ['CUDA_VISIBLE_DEVICES'] = "-1"

TEMPLATE_IMAGE = os.environ['TEMPLATE_IMAGE']

BACKENDS = ['opencv', 'ssd', 'dlib', 'mtcnn', 'retinaface']
MODELS = ["VGG-Face", "Facenet", "Facenet512",
          "OpenFace", "DeepFace", "DeepID", "ArcFace", "Dlib"]


def prep_image(img, ext='png'):
    if not isinstance(img, str) or img[:4] != 'http':
        return img
    # Otherwise, fetch the image
    fname = uuid.uuid4()
    fullname = f'/tmp/{fname}.{ext}'
    urllib.request.urlretrieve(img, fullname)
    return fullname


def verify(event, context):
    uploaded_image = prep_image(event['detail']['url'], event['detail']['ext'])
    template_image = prep_image(TEMPLATE_IMAGE)
    print('[DEBUG]', template_image, uploaded_image)
    obj = DeepFace.verify(template_image, uploaded_image,
                          detector_backend=BACKENDS[4], model_name=MODELS[-2], distance_metric='cosine')
    body = {
        "message": obj,
        "input": event,
    }
    response = {"statusCode": 200, "body": json.dumps(body)}
    return response
