import React,{useState,useRef} from '../../apps/site-web/node_modules/react'
import {createRoot} from '../../apps/site-web/node_modules/react-dom/client'
import {StationaryEquipment} from '../../apps/site-web/src/components/StationaryEquipment'
import {StationaryGenerator} from '../../apps/site-web/src/components/StationaryGenerator'
const context=(window as any).__qaContext
function Harness(){
 const [state,setState]=useState({actor:{accessToken:'synthetic-only',userId:context.owner,role:'owner' as 'owner'|'member'},company:context.companyId,shown:true}),heading=useRef<HTMLHeadingElement>(null)
 ;(window as any).qaSwitch=(kind:string)=>setState(s=>kind==='company'?{...s,company:'76000000-0000-4000-8000-000000009901'}:kind==='actor'?{...s,actor:{...s.actor,userId:'76000000-0000-4000-8000-000000009902',role:'member'}}:{...s,shown:false})
 return <><p>Independent local synthetic component harness</p>{state.shown?(new URLSearchParams(location.search).get('kind')==='generator'?<StationaryGenerator actor={state.actor} workspaceId={state.company} headingRef={heading}/>:<StationaryEquipment actor={state.actor} workspaceId={state.company} headingRef={heading} onNavigate={()=>{}}/>):<p>Component closed</p>}</>
}
createRoot(document.getElementById('root')!).render(<Harness/> )
