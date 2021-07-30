FROM ubuntu:20.04

RUN rm -rf /var/lib/apt/lists/*
RUN apt-get -yq update
RUN apt-get -yq install software-properties-common
RUN add-apt-repository ppa:deadsnakes/ppa
RUN apt-get -yq update
RUN apt-get -yq install python3.8 python3.8-distutils apt-transport-https curl

RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
RUN python3.8 get-pip.py

COPY requirements.txt /root/requirements.txt
RUN python3.8 -m pip install -r /root/requirements.txt
RUN python3.8 -m pip install awslambdaric

RUN sed -i 's|archive.ubuntu|th.archive.ubuntu|g' /etc/apt/sources.list
RUN apt-get -yq update
RUN apt-get -yq install ffmpeg libsm6 libxext6

# This seems hacky but I have no better idea for this
# RUN sed -i 's|str(Path.home())|\"/tmp\"|g' /usr/local/lib/python3.8/dist-packages/deepface/commons/functions.py
RUN grep -rl 'str(Path.home())' /usr/local/lib/python3.8/dist-packages/deepface/ | xargs sed -i 's/str(Path.home())/\"\/tmp\"/g'
RUN grep -rl 'osp.expanduser(\"~\")' /usr/local/lib/python3.8/dist-packages/gdown/ | xargs sed -i 's/osp.expanduser(\"~\")/\"\/tmp\"/g'
RUN grep -rl 'str(Path.home())' /usr/local/lib/python3.8/dist-packages/retinaface/ | xargs sed -i 's/str(Path.home())/\"\/tmp\"/g'

COPY . /usr/src/app
WORKDIR /usr/src/app

ENTRYPOINT [ "python3.8", "-m", "awslambdaric" ]
CMD ["handler.hello"]