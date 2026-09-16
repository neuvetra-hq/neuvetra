import React,{useState,useRef} from '../../apps/site-web/node_modules/react'
import {createRoot} from '../../apps/site-web/node_modules/react-dom/client'
import {ControlledFleet} from '../../apps/site-web/src/components/ControlledFleet'
const owner=(window as any).__qaContext.owner,company=(window as any).__qaContext.companyId
function Harness(){
 const [state,setState]=useState({actor:{accessToken:'synthetic-only',userId:owner,role:'owner' as 'owner'|'member'},company:company,shown:true}),heading=useRef<HTMLHeadingElement>(null)
 ;(window as any).qaSwitch=(kind:string)=>setState(s=>kind==='company'?{...s,company:'75000000-0000-4000-8000-000000009901'}:kind==='actor'?{...s,actor:{...s.actor,userId:'75000000-0000-4000-8000-000000009902',role:'member'}}:{...s,shown:false})
 return <><p>Independent local synthetic component harness</p>{state.shown?<ControlledFleet actor={state.actor} workspaceId={state.company} headingRef={heading} onNavigate={()=>{}}/>:<p>Component closed</p>}</>
}
createRoot(document.getElementById('root')!).render(<Harness/> )
