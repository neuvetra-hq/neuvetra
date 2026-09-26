import { test,expect } from 'bun:test'
import { validateTarget,validateActors,requireRecovery } from '../../tools/staging/hosted-setup-restore-core'
const target={host:'127.0.0.1',port:55479,database:'hosted_setup_restore_1790390000000_abcdef12',role:'supabase_admin'}
test('exact loopback target only',()=>{
  expect(()=>validateTarget(target)).not.toThrow()
  for(const delta of [{host:'localhost'},{host:'db.example.com'},{port:5432},{database:'postgres'},{database:'hosted_setup_restore_1790390000000_abcdef12;drop database postgres'},{role:'postgres'}])expect(()=>validateTarget({...target,...delta})).toThrow('HS_RECOVERY_LOCAL_TARGET_REQUIRED')
})
test('at least one member plus outsider are mandatory',()=>{
  expect(()=>validateActors([])).toThrow()
  expect(()=>validateActors([{id:'00000000-0000-4000-8000-000000000001',companies:[]}])).toThrow()
})
test('errors have no diagnostic interpolation',()=>{expect(()=>requireRecovery(false,'REFUSED')).toThrow('HS_RECOVERY_REFUSED')})
