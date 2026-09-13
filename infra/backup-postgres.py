"""Run on the deployment server: python3 backup-postgres.py [--check]."""
import subprocess, os, json, datetime, pathlib, sys, tarfile
CONTAINER = 'qagdm1omm7pay02zbuhfygiv-225958021869'
os.umask(0o077)
ROOT = pathlib.Path.home() / 'guardiao'
BACKUPS = ROOT / 'backups'
BACKUPS.mkdir(mode=0o700, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
folder = BACKUPS / stamp
folder.mkdir(mode=0o700)
def psql(database, sql):
    return subprocess.check_output(['docker', 'exec', '-i', CONTAINER, 'sh', '-c', 'exec psql -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$1"', 'sh', database], input=sql, text=True).strip()
def counts(database):
    tables = psql(database, "SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema IN ('guardiao','guardiao_demo','guardiao_real') AND table_type='BASE TABLE' ORDER BY 1;").splitlines()
    return {t: int(psql(database, f'SELECT COUNT(*) FROM {t};')) for t in tables}
# PostgreSQL dump uses one consistent transaction; the app's source files and vaults are retained alongside it.
with open(folder / 'database.dump','wb') as out:
    subprocess.run(['docker','exec',CONTAINER,'sh','-c','exec pg_dump -U "$POSTGRES_USER" -d guardiao -n guardiao -n guardiao_demo -n guardiao_real -Fc'],stdout=out,check=True)
subprocess.run(['docker','run','--rm','--entrypoint','sh','-v',str(ROOT / 'data')+':/data:ro','-v',str(folder)+':/backup','postgres:15-alpine','-c','tar -czf /backup/files.tar.gz -C /data sources vaults uploads && chown 1000:1000 /backup/files.tar.gz && chmod 600 /backup/files.tar.gz'],check=True)
report = {'created_at':stamp,'restored':False}
if '--check' in sys.argv:
    db = 'guardiao_restore_' + stamp.lower()
    psql('postgres', f'CREATE DATABASE {db};')
    try:
        with open(folder / 'database.dump','rb') as src:
            subprocess.run(['docker','exec','-i',CONTAINER,'sh','-c','exec pg_restore -U "$POSTGRES_USER" --exit-on-error -d "$1"','sh',db],stdin=src,check=True)
        report['counts'] = counts(db)
        with tarfile.open(folder / 'files.tar.gz') as archive:
            report['files'] = len([x for x in archive if x.isfile()])
        report['restored'] = True
    finally: psql('postgres', f'DROP DATABASE {db};')
(folder/'manifest.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'backup':str(folder),**report},indent=2))
