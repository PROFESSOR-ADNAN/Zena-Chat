# Runbook: MongoDB Service Down

## Symptoms
- Gateway nodes emitting `MongooseServerSelectionError`.
- `/health` returning 500 or failing to respond.
- Socket connections rejected or message sends timing out.

## Diagnosis
```bash
docker compose -f docker/compose.prod.yaml ps mongo
docker compose -f docker/compose.prod.yaml logs -n 50 mongo
```

## Remediation Steps
1. Attempt container restart:
   ```bash
   docker compose -f docker/compose.prod.yaml restart mongo
   ```
2. Verify replica set status:
   ```bash
   docker compose -f docker/compose.prod.yaml exec mongo mongosh --eval "rs.status()"
   ```
3. If corruption occurred, restore from the latest night oplog archive:
   ```bash
   bash scripts/restore.sh /var/backups/zena/latest/mongo_dump.archive.gz
   ```
