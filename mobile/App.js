import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StatusBar as NativeStatusBar,StyleSheet,Text,TextInput,View} from 'react-native';
import MapView,{Marker,Polygon} from 'react-native-maps';
import * as Location from 'expo-location';
import {StatusBar} from 'expo-status-bar';
import {readSavedSession,saveSession,clearSession,mobileRequest,normalizeServer,positionPayload} from './src/api';
import {requestForeground,startNativeTracking,stopNativeTracking} from './src/tracking';

const COLORS={background:'#0B1219',card:'#131D27',card2:'#1B2835',line:'#2E4152',white:'#E9F2F4',muted:'#9AAEBB',teal:'#41D3AE',amber:'#F8BA66',red:'#F07777',blue:'#8CC5EE'};
const TABS=[['inicio','Início'],['mapa','Mapa'],['planos','Planos'],['visitas','Visitas']];
const STAGES=[['visita','Visita'],['contato','Contato'],['proposta','Proposta'],['retorno','Retorno']];
const displayDate=(date)=>{const d=new Date(date);return Number.isFinite(d.valueOf())?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'não disponível';};
const money=(v)=>typeof v==='number'?`R$ ${v.toFixed(2).replace('.',',')}`:'Preço não informado';
const geography=(zone)=>{
  const g=zone.geometry||{};const shapes=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  return shapes.map(rings=>(rings?.[0]||[]).map(pair=>({latitude:Number(pair[1]),longitude:Number(pair[0])}))).filter(points=>points.length>=4&&points.every(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)));
};
const Button=({children,onPress,disabled=false,secondary=false,danger=false,small=false})=><Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.buttonSecondary,danger&&styles.buttonDanger,small&&styles.buttonSmall,(pressed||disabled)&&{opacity:0.55}]}><Text style={[styles.buttonText,secondary&&styles.buttonSecondaryText]}>{children}</Text></Pressable>;
const Chip=({text,selected,onPress})=><Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip,selected&&styles.chipSelected]}><Text style={[styles.chipText,selected&&styles.chipTextSelected]}>{text}</Text></Pressable>;
const Field=({label,value,onChangeText,keyboardType='default',placeholder='',autoCapitalize='none',secureTextEntry=false})=><View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#5F798A" keyboardType={keyboardType} autoCapitalize={autoCapitalize} autoCorrect={false} secureTextEntry={secureTextEntry}/></View>;
const Pill=({children,tone='muted'})=><View style={[styles.pill,tone==='green'&&styles.pillGreen,tone==='yellow'&&styles.pillYellow,tone==='red'&&styles.pillRed]}><Text style={styles.pillText}>{children}</Text></View>;
const Section=({eyebrow,title,children})=><View style={styles.section}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;

export default function App(){
  const [boot,setBoot]=useState(true);
  const [busy,setBusy]=useState(false);
  const [session,setSession]=useState(null);
  const [remoteSession,setRemoteSession]=useState(null);
  const [server,setServer]=useState('');
  const [code,setCode]=useState('');
  const [tab,setTab]=useState('inicio');
  const [notice,setNotice]=useState('');
  const [tracking,setTracking]=useState('Desligado');
  const [pos,setPos]=useState(null);
  const [catalog,setCatalog]=useState({plans:[],ctos:[],zones:[]});
  const [team,setTeam]=useState([]);
  const [visits,setVisits]=useState([]);
  const [planId,setPlanId]=useState(null);
  const [ctoId,setCtoId]=useState(null);
  const [lat,setLat]=useState('');
  const [lon,setLon]=useState('');
  const [stage,setStage]=useState('visita');
  const [offerResult,setOfferResult]=useState(null);
  const watch=useRef(null);

  const sendGPS=useCallback(async (location)=>{
    setPos(location);
    try{
      const saved=await readSavedSession();if(!saved)return;
      await mobileRequest(saved.apiUrl,'location',{method:'POST',token:saved.token,data:positionPayload(location)});
    }catch(e){
      if(e.status!==429&&e.status!==409)setNotice('GPS obtido, mas servidor não confirmou o envio. Confira a rede.');
    }
  },[]);

  const fetchData=useCallback(async (auth,quiet=false)=>{
    const options={token:auth.token};
    try{
      const profile=await mobileRequest(auth.apiUrl,'session',options);
      setRemoteSession(profile);
      const [cat,visitList]=await Promise.all([
        mobileRequest(auth.apiUrl,'catalog',options),
        mobileRequest(auth.apiUrl,'visits',options)
      ]);
      setCatalog(cat);setVisits(visitList.visits||[]);
      if(profile.user.role==='supervisor'){
        const t=await mobileRequest(auth.apiUrl,'team',options);setTeam(t.members||[]);
      }else setTeam([]);
      if(!quiet)setNotice('Informações atualizadas.');
      return profile;
    }catch(e){
      if(e.status===401){await stopNativeTracking(watch);setTracking('Desligado');await clearSession();setSession(null);setRemoteSession(null);setNotice('Acesso vencido ou revogado. Pareie novamente.');}
      else setNotice(`Sem atualização: ${e.message}`);
      throw e;
    }
  },[]);

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try{
        const saved=await readSavedSession();
        if(!mounted)return;
        if(saved?.token&&saved?.apiUrl){
          setSession(saved);setServer(saved.apiUrl);
          try{await fetchData(saved,true);}catch{}
        }
      }catch(e){if(mounted)setNotice('Não foi possível ler a sessão salva.');}
      finally{if(mounted)setBoot(false);}
    })();
    return()=>{mounted=false;if(watch.current){watch.current.remove();watch.current=null;}};
  },[fetchData]);

  const withBusy=async(fn)=>{
    if(busy)return;setBusy(true);
    try{await fn();}catch(e){setNotice(e.message||'Falha na operação.');Alert.alert('Atenção',e.message||'Verifique a conexão.');}
    finally{setBusy(false);}
  };

  const pair=()=>withBusy(async()=>{
    const apiUrl=normalizeServer(server);
    const result=await mobileRequest(apiUrl,'pair',{method:'POST',data:{code:code.trim()}});
    const auth={apiUrl,token:result.token,expiresAt:result.expiresAt};
    await saveSession(auth);setSession(auth);setCode('');
    await fetchData(auth,true);setNotice('Aparelho autorizado para homologação.');
  });

  const start=()=>withBusy(async()=>{
    if(!session)throw new Error('Pareie o aparelho antes de iniciar a jornada.');
    await requestForeground();
    await mobileRequest(session.apiUrl,'shift/start',{method:'POST',token:session.token});
    let mode;
    try{mode=await startNativeTracking(watch,sendGPS);}catch(e){
      await mobileRequest(session.apiUrl,'shift/stop',{method:'POST',token:session.token}).catch(()=>{});
      throw e;
    }
    setTracking(mode.background?'Segundo plano':'Somente primeiro plano');
    setNotice(mode.message);
    const location=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}).catch(()=>null);
    if(location)sendGPS(location);
    await fetchData(session,true);
  });

  const stop=()=>withBusy(async()=>{
    await stopNativeTracking(watch);setTracking('Desligado');
    if(!session)return;
    await mobileRequest(session.apiUrl,'shift/stop',{method:'POST',token:session.token});
    await fetchData(session,true);
    setNotice('Jornada encerrada. O aplicativo interrompeu a transmissão de localização.');
  });

  const logout=()=>withBusy(async()=>{
    await stopNativeTracking(watch);setTracking('Desligado');
    if(session&&remoteSession?.shift){
      // Não desconectamos se o encerramento não foi confirmado pelo servidor.
      await mobileRequest(session.apiUrl,'shift/stop',{method:'POST',token:session.token});
    }
    await clearSession();setSession(null);setRemoteSession(null);setNotice('Aparelho desconectado. Para voltar, gere outro código de pareamento.');
  });

  const evaluateOffer=()=>withBusy(async()=>{
    if(!session)throw new Error('Sessão não iniciada.');
    if(!planId)throw new Error('Escolha um plano.');
    if(!lat.trim()||!lon.trim())throw new Error('Informe as coordenadas do endereço de instalação.');
    const result=await mobileRequest(session.apiUrl,'evaluate',{
      method:'POST',token:session.token,data:{lat:Number(lat.replace(',','.')),lon:Number(lon.replace(',','.')),planId,ctoId}
    });
    setOfferResult(result);
    setNotice('Simulação concluída. Este resultado não libera venda no ST1 Sales.');
  });

  const createVisit=()=>withBusy(async()=>{
    if(!remoteSession?.shift)throw new Error('É necessário iniciar a jornada para registrar a visita.');
    if(!lat.trim()||!lon.trim())throw new Error('Informe latitude e longitude do ponto de visita.');
    await mobileRequest(session.apiUrl,'visits',{
      method:'POST',token:session.token,data:{stage,lat:Number(lat.replace(',','.')),lon:Number(lon.replace(',','.'))}
    });
    await fetchData(session,true);setNotice('Visita registrada somente no laboratório.');
  });

  const useCurrentPosition=async()=>{
    if(pos){setLat(String(pos.coords.latitude));setLon(String(pos.coords.longitude));return;}
    try{
      await requestForeground();const location=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      setPos(location);setLat(String(location.coords.latitude));setLon(String(location.coords.longitude));
    }catch(e){setNotice(e.message);}
  };

  const tabs=[...TABS,...(remoteSession?.user.role==='supervisor'?[['equipe','Equipe']]:[])];
  const onShift=Boolean(remoteSession?.shift);
  const user=remoteSession?.user;

  function renderHome(){return <>
    <Section eyebrow="PAINEL DE CAMPO" title={`Olá, ${user?.name?.split(' ')[0]||'PAP'}`}>
      <Text style={styles.body}>Equipe {user?.team||'não informada'} • {user?.role==='supervisor'?'Supervisor':'Vendedor'}</Text>
      <View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statLabel}>JORNADA</Text><Text style={[styles.statValue,onShift&&{color:COLORS.teal}]}>{onShift?'ATIVA':'ENCERRADA'}</Text></View><View style={styles.stat}><Text style={styles.statLabel}>GPS</Text><Text style={styles.statValue}>{tracking}</Text></View></View>
      <View style={styles.noticeCard}><Pill tone={onShift?'green':'muted'}>{onShift?'Compartilhamento autorizado':'Localização desativada'}</Pill><Text style={styles.body}>A localização é enviada somente após você iniciar a jornada. Finalize ao encerrar suas atividades.</Text></View>
      {!onShift?<Button onPress={start} disabled={busy}>Iniciar jornada e GPS</Button>:<Button danger onPress={stop} disabled={busy}>Encerrar jornada e parar GPS</Button>}
      {onShift&&tracking==='Desligado'?<Button secondary onPress={start}>Retomar GPS nesta sessão</Button>:null}
    </Section>
    <Section eyebrow="ÚLTIMO SINAL" title="Localização do aparelho">
      <Text style={styles.body}>{pos?`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`:'Nenhuma amostra nesta sessão.'}</Text>
      <Text style={styles.caption}>O GPS não é evidência de disponibilidade de rede no endereço de instalação.</Text>
      <Button secondary small onPress={()=>withBusy(async()=>{await fetchData(session);})}>Atualizar dados do servidor</Button>
    </Section>
  </>;}

  function renderMap(){
    const allMarkers=user?.role==='supervisor'?team.filter(s=>s.position).map(s=>({id:s.id,name:s.name,lat:s.position.lat,lon:s.position.lon,fresh:s.position.fresh})):[];
    const own=pos?{latitude:pos.coords.latitude,longitude:pos.coords.longitude}:null;
    const target=own||(allMarkers.length?{latitude:allMarkers[0].lat,longitude:allMarkers[0].lon}:{latitude:-2.538,longitude:-44.285});
    return <Section eyebrow="SITUAÇÃO TERRITORIAL" title="Mapa de campo">
      <Text style={styles.body}>Camadas de CTOs, territórios e posições autorizadas. As áreas são ilustrativas; somente a avaliação do servidor decide a elegibilidade.</Text>
      <View style={styles.mapFrame}><MapView style={StyleSheet.absoluteFillObject} initialRegion={{...target,latitudeDelta:.04,longitudeDelta:.05}}>
        {(catalog.zones||[]).flatMap(zone=>geography(zone).map((coords,index)=><Polygon key={`${zone.id}-${index}`} coordinates={coords} fillColor="rgba(65,211,174,0.12)" strokeColor={zone.color||COLORS.teal} strokeWidth={2}/>))}
        {(catalog.ctos||[]).map(c=><Marker key={`cto-${c.id}`} coordinate={{latitude:c.lat,longitude:c.lon}} title={c.name} description="CTO de laboratório" pinColor={COLORS.amber}/>)}
        {allMarkers.map(s=><Marker key={`seller-${s.id}`} coordinate={{latitude:s.lat,longitude:s.lon}} title={s.name} description={s.fresh?'GPS recente':'GPS desatualizado'} pinColor={s.fresh?COLORS.teal:COLORS.red}/>)}
        {own&&<Marker coordinate={own} title="Minha posição" description="Localização do dispositivo" pinColor={COLORS.blue}/>}
      </MapView></View>
      <Text style={styles.caption}>{catalog.zones.length} territórios • {catalog.ctos.length} CTOs • {allMarkers.length} membros visíveis</Text>
      <Button secondary small onPress={()=>withBusy(async()=>fetchData(session))}>Atualizar posições</Button>
    </Section>;
  }

  function renderOffers(){return <>
    <Section eyebrow="MATRIZ DE ELEGIBILIDADE" title="Consultar um plano">
      <Text style={styles.body}>Informe o ponto de instalação do cliente, não apenas o lugar onde você está.</Text>
      <Text style={styles.label}>PLANO DE HOMOLOGAÇÃO</Text>
      <View style={styles.chipWrap}>{(catalog.plans||[]).map(p=><Chip key={p.id} text={`${p.name} · ${money(p.price)}`} selected={p.id===planId} onPress={()=>{setPlanId(p.id);setOfferResult(null);}}/>)}</View>
      <Text style={styles.label}>CTO ASSOCIADA</Text>
      <View style={styles.chipWrap}><Chip text="Não definida" selected={!ctoId} onPress={()=>setCtoId(null)}/>{(catalog.ctos||[]).map(c=><Chip key={c.id} text={`${c.name} (${c.ports_free} portas)`} selected={c.id===ctoId} onPress={()=>setCtoId(c.id)}/>)}</View>
      <Field label="LATITUDE DO IMÓVEL" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="-2.537"/>
      <Field label="LONGITUDE DO IMÓVEL" value={lon} onChangeText={setLon} keyboardType="numbers-and-punctuation" placeholder="-44.299"/>
      <Button secondary small onPress={useCurrentPosition}>Usar GPS apenas como ponto de referência</Button>
      <Button onPress={evaluateOffer} disabled={busy}>Simular disponibilidade</Button>
    </Section>
    {offerResult&&<Section eyebrow="RESULTADO SIMULADO" title={offerResult.status.replace('_',' ')}>
      <Pill tone={offerResult.status==='LIBERADO'?'green':offerResult.status==='BLOQUEADO'?'red':'yellow'}>{offerResult.status}</Pill>
      {(offerResult.reasons||[]).map((reason,index)=><Text key={index} style={styles.body}>• {reason}</Text>)}
      <Text style={styles.warning}>Este resultado não libera uma venda real ou contrato no ST1 Sales.</Text>
    </Section>}
  </>;}

  function renderVisits(){return <>
    <Section eyebrow="EXECUÇÃO EM CAMPO" title="Registrar atividade">
      <Text style={styles.body}>Registre a etapa e as coordenadas. Nesta versão não são armazenados nome, documentos ou endereço do cliente.</Text>
      <View style={styles.chipWrap}>{STAGES.map(([value,label])=><Chip key={value} selected={stage===value} onPress={()=>setStage(value)} text={label}/>)}</View>
      <Text style={styles.caption}>Coordenadas compartilhadas com a consulta de oferta:</Text>
      <Field label="LATITUDE" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="-2.537"/>
      <Field label="LONGITUDE" value={lon} onChangeText={setLon} keyboardType="numbers-and-punctuation" placeholder="-44.299"/>
      <Button secondary small onPress={useCurrentPosition}>Preencher com minha posição atual</Button>
      <Button onPress={createVisit} disabled={busy||!onShift}>Registrar atividade do laboratório</Button>
      {!onShift&&<Text style={styles.warning}>Inicie a jornada antes de registrar visitas.</Text>}
    </Section>
    <Section eyebrow="HISTÓRICO DO LABORATÓRIO" title="Últimas atividades">
      {visits.length?visits.map(v=><View key={v.id} style={styles.listRow}><Text style={styles.listTitle}>{STAGES.find(x=>x[0]===v.stage)?.[1]||v.stage}</Text><Text style={styles.caption}>{displayDate(v.created_at)} • {Number(v.lat).toFixed(4)}, {Number(v.lon).toFixed(4)}</Text></View>):<Text style={styles.body}>Nenhuma visita registrada.</Text>}
    </Section>
  </>;}

  function renderTeam(){return <Section eyebrow="ACESSO DE SUPERVISOR" title="Minha equipe">
    <Text style={styles.body}>Visualização restrita à equipe {user?.team}. Não é possível acompanhar outras equipes por este aplicativo.</Text>
    {team.map(m=><View key={m.id} style={styles.teamRow}><View><Text style={styles.listTitle}>{m.name}</Text><Text style={styles.caption}>{m.position?`${m.position.lat.toFixed(4)}, ${m.position.lon.toFixed(4)} · ${displayDate(m.position.updatedAt)}`:'Sem localização registrada'}</Text></View><Pill tone={m.onShift&&m.position?.fresh?'green':m.onShift?'yellow':'muted'}>{m.onShift&&m.position?.fresh?'Em campo':m.onShift?'Sem sinal':'Fora da jornada'}</Pill></View>)}
    {!team.length&&<Text style={styles.body}>Nenhum membro da sua equipe foi retornado.</Text>}
    <Button secondary onPress={()=>withBusy(async()=>fetchData(session))}>Atualizar minha equipe</Button>
  </Section>;}

  if(boot)return <SafeAreaView style={styles.safe}><StatusBar style="light"/><View style={styles.center}><ActivityIndicator color={COLORS.teal} size="large"/><Text style={styles.body}>Conectando ao laboratório...</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><StatusBar style="light"/><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>S<Text style={{color:COLORS.teal}}>1</Text></Text></View><View style={{flex:1}}><Text style={styles.headerTitle}>ST1 SALES / PAP</Text><Text style={styles.headerSub}>FIELD OPERATIONS • HOMOLOGAÇÃO</Text></View><Pill tone="yellow">LAB</Pill></View>
    {!session?<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <Section eyebrow="PRIMEIRO ACESSO" title="Conectar dispositivo">
        <Text style={styles.body}>O gestor deve criar um código temporário na aba Aplicativo PAP do painel Web. Não é necessário instalar o painel no celular.</Text>
        <Field label="ENDEREÇO DA API MÓVEL" value={server} onChangeText={setServer} placeholder="http://192.168.0.10:4174"/>
        <Field label="CÓDIGO DE PAREAMENTO" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="16 caracteres"/>
        <Button disabled={busy||!code.trim()} onPress={pair}>{busy?'Conectando...':'Parear aplicativo'}</Button>
        <Text style={styles.caption}>HTTP é permitido somente em redes privadas de teste. Para acompanhamento real fora da LAN, utilize uma API com HTTPS.</Text>
      </Section>
      {notice?<Text style={styles.warning}>{notice}</Text>:null}
      </ScrollView>:<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabRow}>{tabs.map(([id,label])=><Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id}} onPress={()=>setTab(id)} style={[styles.tab,tab===id&&styles.tabActive]}><Text style={[styles.tabText,tab===id&&styles.tabTextActive]}>{label}</Text></Pressable>)}</ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        {notice?<View style={styles.info}><Text style={styles.infoText}>{notice}</Text></View>:null}
        {tab==='inicio'?renderHome():tab==='mapa'?renderMap():tab==='planos'?renderOffers():tab==='visitas'?renderVisits():renderTeam()}
        <View style={styles.footer}><Text style={styles.caption}>Dados locais do piloto • Sem vendas reais • Sem ST1 Connect</Text><Button secondary small onPress={logout} disabled={busy}>Desconectar aparelho</Button></View>
      </ScrollView>
      </>}
    {busy&&<View style={styles.busy}><ActivityIndicator color={COLORS.teal} size="small"/></View>}
    </KeyboardAvoidingView></SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:COLORS.background,paddingTop:Platform.OS==='android'?(NativeStatusBar.currentHeight||0):0},
 center:{flex:1,justifyContent:'center',alignItems:'center',gap:16},
 header:{paddingVertical:18,paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:12,borderBottomColor:COLORS.line,borderBottomWidth:1},
 logo:{width:42,height:42,borderRadius:12,backgroundColor:'#18342F',alignItems:'center',justifyContent:'center'},logoText:{fontSize:24,fontWeight:'900',color:COLORS.white},
 headerTitle:{color:COLORS.white,fontSize:13,fontWeight:'900',letterSpacing:1.4},headerSub:{color:COLORS.muted,fontSize:9,marginTop:5,fontWeight:'600',letterSpacing:1},
 tabs:{flexGrow:0,borderBottomWidth:1,borderBottomColor:COLORS.line,maxHeight:58},tabRow:{paddingHorizontal:16,alignItems:'center',gap:7},
 tab:{paddingHorizontal:15,paddingVertical:12,borderRadius:9},tabActive:{backgroundColor:'#1A3E36'},tabText:{fontSize:12,color:COLORS.muted,fontWeight:'700'},tabTextActive:{color:COLORS.teal},
 scroll:{padding:18,paddingBottom:55,gap:14},section:{borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.card,borderRadius:17,padding:17,gap:13},
 eyebrow:{color:COLORS.teal,fontSize:10,letterSpacing:2,fontWeight:'900'},sectionTitle:{color:COLORS.white,fontSize:23,fontWeight:'800',letterSpacing:-0.6},
 label:{fontSize:10,letterSpacing:1.5,color:COLORS.muted,fontWeight:'900'},field:{gap:8},
 input:{backgroundColor:COLORS.background,borderColor:COLORS.line,borderWidth:1,borderRadius:10,color:COLORS.white,paddingHorizontal:13,paddingVertical:13,fontSize:14},
 body:{color:COLORS.muted,fontSize:13,lineHeight:21},caption:{color:'#8199A9',fontSize:11,lineHeight:17},
 button:{paddingVertical:14,paddingHorizontal:18,borderRadius:10,backgroundColor:COLORS.teal,alignItems:'center',justifyContent:'center',marginTop:2},buttonText:{fontSize:13,fontWeight:'900',color:'#09241D',textAlign:'center'},
 buttonSecondary:{borderColor:COLORS.line,borderWidth:1,backgroundColor:COLORS.card2},buttonSecondaryText:{color:COLORS.white},buttonDanger:{backgroundColor:COLORS.red},buttonSmall:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:14},
 pill:{alignSelf:'flex-start',backgroundColor:'#30404D',paddingHorizontal:9,paddingVertical:5,borderRadius:7},pillGreen:{backgroundColor:'#1C5345'},pillYellow:{backgroundColor:'#68502F'},pillRed:{backgroundColor:'#593039'},pillText:{color:COLORS.white,fontSize:10,fontWeight:'800'},
 statsRow:{flexDirection:'row',gap:10},stat:{flex:1,backgroundColor:COLORS.background,padding:13,borderRadius:11,gap:8},statLabel:{color:COLORS.muted,fontSize:9,fontWeight:'800',letterSpacing:1.3},statValue:{color:COLORS.white,fontSize:15,fontWeight:'800'},
 noticeCard:{borderLeftWidth:3,borderLeftColor:COLORS.teal,backgroundColor:'#172C2B',padding:13,borderRadius:8,gap:10},
 chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderWidth:1,borderColor:COLORS.line,borderRadius:9,paddingVertical:10,paddingHorizontal:12,backgroundColor:COLORS.background},chipSelected:{backgroundColor:'#1B4A40',borderColor:COLORS.teal},chipText:{color:COLORS.muted,fontSize:11,fontWeight:'700'},chipTextSelected:{color:COLORS.teal},
 mapFrame:{height:320,borderWidth:1,borderColor:COLORS.line,borderRadius:12,overflow:'hidden'},
 warning:{color:COLORS.amber,fontSize:12,lineHeight:19,marginTop:6},listRow:{paddingVertical:10,borderTopWidth:1,borderTopColor:COLORS.line,gap:4},listTitle:{fontSize:13,color:COLORS.white,fontWeight:'800'},
 teamRow:{paddingVertical:13,borderBottomWidth:1,borderBottomColor:COLORS.line,flexDirection:'row',gap:12,justifyContent:'space-between',alignItems:'center'},
 info:{backgroundColor:'#1E3D37',borderRadius:8,padding:12},infoText:{fontSize:11,color:'#BFECDD',lineHeight:17},
 footer:{gap:12,marginTop:14,paddingBottom:16},busy:{position:'absolute',bottom:8,right:16,padding:8,backgroundColor:COLORS.card,borderRadius:20}
});
