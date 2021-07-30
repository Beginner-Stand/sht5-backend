import os
import json
from deepface import DeepFace

os.environ['CUDA_VISIBLE_DEVICES'] = "-1"

BACKENDS = ['opencv', 'ssd', 'dlib', 'mtcnn', 'retinaface']
MODELS = ["VGG-Face", "Facenet", "Facenet512", "OpenFace", "DeepFace", "DeepID", "ArcFace", "Dlib"]

def verify(event, context) -> dict:
    body = json.loads(event['body'])
    img1 = body['img1']
    img2 = body['img2']
    obj = DeepFace.verify(img1, img2, detector_backend = BACKENDS[4], model_name=MODELS[-2], distance_metric='cosine')
    body = {
        "message": obj,
        "input": event,
    }
    response = {"statusCode": 200, "body": json.dumps(body)}
    return response