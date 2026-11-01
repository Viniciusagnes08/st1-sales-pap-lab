import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {readSavedSession,clearSession,mobileRequest,positionPayload} from './api';

export const GPS_TASK='pap-homolog-gps-v2';
// O JS da tarefa fica no topo do módulo e não depende de a interface estar montada.
TaskManager.defineTask(GPS_TASK,async ({data,error})=>{
  if(error){console.warn('[PAP GPS] background location error',error.message);return;}
  const locations=data?.locations||[];
  if(!locations.length)return;
  try {
    const session=await readSavedSession();
    if(!session?.token || !session?.apiUrl)return;
    // Amostras antigas são descartadas pelo servidor. Não gravamos coordenadas offline no aparelho.
    const last=locations[locations.length-1];
    await mobileRequest(session.apiUrl,'location',{method:'POST',token:session.token,data:positionPayload(last)});
  }catch(e){
    if(e.status===401){
      await clearSession().catch(()=>{});
      await Location.stopLocationUpdatesAsync(GPS_TASK).catch(()=>{});
    }
    console.warn('[PAP GPS] Falha no envio; não presumir atualização:',e.message);
  }
});

export async function requestForeground(){
  const permission=await Location.requestForegroundPermissionsAsync();
  if(permission.status!=='granted')throw new Error('Permissão de localização em uso negada.');
}
export async function stopNativeTracking(watchRef){
  if(watchRef?.current){try{watchRef.current.remove();}finally{watchRef.current=null;}}
  try{if(await Location.hasStartedLocationUpdatesAsync(GPS_TASK))await Location.stopLocationUpdatesAsync(GPS_TASK);}catch(e){console.warn('[PAP GPS] Falha ao parar tarefa nativa:',e.message);}
}
export async function startNativeTracking(watchRef,onLocation){
  let granted=false;
  try{
    const allowed=await Location.isBackgroundLocationAvailableAsync();
    if(allowed){
      const permission=await Location.requestBackgroundPermissionsAsync();
      granted=permission.status==='granted';
    }
  }catch(e){console.warn('[PAP GPS] Background indisponível:',e.message);}
  if(granted){
    try{
      if(!await Location.hasStartedLocationUpdatesAsync(GPS_TASK)){
        await Location.startLocationUpdatesAsync(GPS_TASK,{
          accuracy:Location.Accuracy.Balanced,
          timeInterval:30000,
          distanceInterval:35,
          deferredUpdatesInterval:30000,
          pausesUpdatesAutomatically:false,
          showsBackgroundLocationIndicator:true,
          foregroundService:{notificationTitle:'PAP | Jornada ativa',notificationBody:'Compartilhando localização durante a jornada',notificationColor:'#11A581'}
        });
      }
      return {background:true,message:'GPS autorizado em segundo plano. O sistema operacional pode limitar as atualizações.'};
    }catch(e){console.warn('[PAP GPS] Usando apenas o foreground:',e.message);}
  }
  if(watchRef?.current)watchRef.current.remove();
  watchRef.current=await Location.watchPositionAsync({
    accuracy:Location.Accuracy.Balanced,timeInterval:30000,distanceInterval:35
  },onLocation);
  return {background:false,message:'GPS apenas enquanto o app estiver aberto. Para uso em segundo plano, instale um development build e conceda a permissão Sempre.'};
}
