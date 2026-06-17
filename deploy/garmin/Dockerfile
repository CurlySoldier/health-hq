FROM python:3.12-alpine

COPY deploy/garmin/entrypoint.sh /entrypoint.sh
COPY deploy/garmin/run_garmindb.py /run_garmindb.py
RUN chmod +x /entrypoint.sh

CMD ["sh", "/entrypoint.sh"]
