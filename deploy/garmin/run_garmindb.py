#!/usr/bin/env python3

import logging
import runpy
import shutil
import sys
import sqlite3
from pathlib import Path

import fitfile
from garmindb.garmindb import File, MonitoringInfo
from garmindb.monitoring_fit_file_processor import MonitoringFitFileProcessor


LOGGER = logging.getLogger("healthhq.garmindb")


# ----------------------------
# Garmin safety normalization
# ----------------------------
def _safe_activity_type(raw_activity_type):
    activity_type_enum = fitfile.field_enums.ActivityType

    if isinstance(raw_activity_type, activity_type_enum):
        return raw_activity_type

    try:
        numeric_value = int(getattr(raw_activity_type, "value", raw_activity_type))
    except (TypeError, ValueError):
        numeric_value = None

    if numeric_value is not None:
        try:
            return activity_type_enum(numeric_value)
        except ValueError:
            return activity_type_enum.invalid

    token = str(raw_activity_type).strip()

    if token.startswith("<") and token.endswith(">"):
        token = token[1:-1].strip()

    if ":" in token:
        token = token.split(":", 1)[0].strip()

    if "." in token:
        token = token.rsplit(".", 1)[-1].strip()

    if token.lower().startswith("unknownenumvalue"):
        return activity_type_enum.invalid

    return activity_type_enum.__members__.get(token, activity_type_enum.invalid)


# ----------------------------
# ORIGINAL Garmin DB patch
# ----------------------------
def _patched_write_monitoring_info_entry(self, fit_file, message_fields):
    activity_types = message_fields.activity_type
    if not isinstance(activity_types, list):
        return

    file_id = File.s_get_id(self.garmin_db_session, fit_file.filename)
    timestamp = message_fields.local_timestamp
    resting_metabolic_rate = message_fields.get("resting_metabolic_rate")

    for index, activity_type in enumerate(activity_types):
        safe_activity_type = _safe_activity_type(activity_type)

        if safe_activity_type != activity_type:
            LOGGER.warning(
                "Unknown monitoring activity_type %r in %s; falling back to %s",
                activity_type,
                fit_file.filename,
                safe_activity_type,
            )

        entry = {
            "file_id": file_id,
            "timestamp": timestamp,
            "activity_type": safe_activity_type,
            "resting_metabolic_rate": resting_metabolic_rate,
        }

        cycles_to_distance = message_fields.cycles_to_distance
        if isinstance(cycles_to_distance, (tuple, list)) and index < len(cycles_to_distance):
            entry["cycles_to_distance"] = cycles_to_distance[index]

        cycles_to_calories = message_fields.cycles_to_calories
        if isinstance(cycles_to_calories, (tuple, list)) and index < len(cycles_to_calories):
            entry["cycles_to_calories"] = cycles_to_calories[index]

        MonitoringInfo.s_insert_or_update(self.garmin_mon_db_session, entry)


# ----------------------------
# NEW: HealthHQ importer
# ----------------------------
def _import_to_health_db():
    garmin_db = Path("/app/data/garmin/HealthData/DBs/garmin_activities.db")
    health_db = Path("/app/data/healthhq.db")

    if not garmin_db.exists():
        raise RuntimeError(f"Missing Garmin DB: {garmin_db}")

    if not health_db.exists():
        raise RuntimeError(f"Missing HealthHQ DB: {health_db}")

    con = sqlite3.connect(str(health_db))
    cur = con.cursor()

    # IMPORTANT: we DO NOT assume schema exists anymore
    # We only insert into existing table if present
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]

    if "activities" not in tables:
        raise RuntimeError("HealthHQ DB has no 'activities' table. Run app migration first.")

    try:
        cur.execute("ATTACH DATABASE ? AS garmin", (str(garmin_db),))

        # safe insert: only map columns that likely exist
        cur.execute("""
            INSERT OR IGNORE INTO activities (id, start_time, activity_type)
            SELECT
                id,
                start_time,
                activity_type
            FROM garmin.activities
        """)

        con.commit()
        cur.execute("DETACH DATABASE garmin")

        print("[OK] Imported Garmin activities into HealthHQ DB")

    finally:
        con.close()


# ----------------------------
# CLI runner
# ----------------------------
def _run_cli():
    mode = None
    if len(sys.argv) > 1 and sys.argv[1].startswith("--mode="):
        mode = sys.argv[1].split("=", 1)[1]
        sys.argv.pop(1)

    # HEALTH IMPORT MODE
    if mode == "health-import":
        _import_to_health_db()
        return

    # DEFAULT: Garmin DB behaviour
    cli_path = shutil.which("garmindb_cli.py")
    if not cli_path:
        raise RuntimeError("Could not find garmindb_cli.py on PATH")

    MonitoringFitFileProcessor._write_monitoring_info_entry = _patched_write_monitoring_info_entry
    sys.argv = [cli_path, *sys.argv[1:]]
    runpy.run_path(cli_path, run_name="__main__")


if __name__ == "__main__":
    _run_cli()