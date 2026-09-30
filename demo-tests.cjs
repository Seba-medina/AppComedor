// El prototipo local fue reemplazado por Firebase. Ejecutar las pruebas vigentes.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync(process.execPath,['--test',path.join(__dirname,'tests/domain.test.mjs')],{stdio:'inherit'});
process.exitCode=result.status??1;
