export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"ai_not_configured"});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    const message=String(body.message||'').slice(0,4000);
    const context=body.context||{};
    const system=`Você é o Assistente do Meu Planner Digital. Ajude o usuário a organizar vida, tarefas, compromissos, hábitos, metas SMART e planejamento. Analise e sugira, mas nunca afirme que alterou dados. Toda mudança deve ser proposta para aprovação do usuário. Seja direto, prático e em português do Brasil.`;
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||'gpt-5-mini',
        input:[
          {role:'system',content:[{type:'input_text',text:system}]},
          {role:'user',content:[{type:'input_text',text:`Contexto do Planner:\n${JSON.stringify(context).slice(0,18000)}\n\nPedido do usuário:\n${message}`}]}
        ],
        max_output_tokens:700
      })
    });
    if(!response.ok){const detail=await response.text();return res.status(response.status).json({error:'openai_error',detail:detail.slice(0,500)})}
    const json=await response.json();
    const text=json.output_text||json.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||'';
    return res.status(200).json({text});
  }catch(error){return res.status(500).json({error:'assistant_failed',detail:String(error?.message||error)})}
}
