import {createRoot} from 'react-dom/client'
import {CompanySetup} from '../../apps/site-web/src/components/CompanySetup'
const root=createRoot(document.getElementById('root')!)
;(window as any).qaMount=(userId:string,workspaceId:string)=>root.render(<CompanySetup key={userId+':'+workspaceId} actor={{userId,accessToken:userId,role:'owner'}} workspaceId={workspaceId} headingRef={{current:null}} />)
;(window as any).qaUnmount=()=>root.render(<p>Signed out</p>)
