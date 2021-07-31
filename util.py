import urllib.request
import uuid


def prep_image(img, ext='png'):
    if not isinstance(img, str) or img[:4] != 'http':
        return img
    # Otherwise, fetch the image
    fname = uuid.uuid4()
    fullname = f'/tmp/{fname}.{ext}'
    urllib.request.urlretrieve(img, fullname)
    return fullname
