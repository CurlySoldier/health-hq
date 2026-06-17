FROM python:3.12-alpine

COPY garmin/entrypoint.sh /entrypoint.sh
COPY garmin/run_garmindb.py /run_garmindb.py
RUN chmod +x /entrypoint.sh

CMD ["sh", "/entrypoint.sh"]
