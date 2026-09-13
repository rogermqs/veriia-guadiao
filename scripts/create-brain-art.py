from pathlib import Path
import random, math
random.seed(73)
left='M314 106 C289 80 255 87 242 112 C212 103 184 129 185 157 C152 166 144 190 156 216 C128 244 142 277 162 290 C146 321 163 349 192 354 C191 387 221 405 245 395 C263 424 297 410 314 392 Z'
folds=['M242 112 C261 131 249 159 226 160 S184 181 201 205','M185 157 C213 157 223 184 213 198 S220 232 244 225 S276 199 296 221','M156 216 C186 220 185 249 204 257 S241 248 252 273','M162 290 C185 277 204 293 207 311 S238 333 257 312 S286 296 304 316','M192 354 C218 348 229 368 225 391','M314 136 C280 124 280 151 289 171 S306 187 289 205','M314 256 C287 234 273 264 281 281','M314 360 C285 346 271 366 276 392','M203 257 C180 253 171 266 176 279']
body='<defs><linearGradient id="gold" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9c7a40"/><stop offset=".5" stop-color="#e1bc76"/><stop offset="1" stop-color="#fff0bc"/></linearGradient><radialGradient id="halo"><stop stop-color="#d7b878" stop-opacity=".22"/><stop offset="1" stop-color="#d7b878" stop-opacity="0"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter><clipPath id="brain-clip"><path d="'+left+'"/><path d="'+left+'" transform="translate(640 0) scale(-1 1)"/></clipPath></defs>'
body+='<ellipse cx="320" cy="260" rx="240" ry="225" fill="url(#halo)"/><g class="brain-tissue">'
for transform in ['', 'translate(640 0) scale(-1 1)']:
 body+=f'<g transform="{transform}"><path d="{left}" fill="#c7a65f" fill-opacity=".035" stroke="url(#gold)" stroke-width="2.3"/>'
 for f in folds:body+=f'<path d="{f}" fill="none" stroke="url(#gold)" stroke-width="1.4" opacity=".7"/>'
 body+='</g>'
body+='<path d="M314 387 Q303 426 320 447 Q339 421 326 387" fill="none" stroke="url(#gold)" stroke-width="2"/>'
pts=[(x+random.uniform(-9,9),y+random.uniform(-9,9)) for y in range(115,408,29) for x in range(154,495,30)]
body+='<g clip-path="url(#brain-clip)">'
for i,(x,y) in enumerate(pts):
 for j in range(i+1,len(pts)):
  a,b=pts[j];d=math.hypot(x-a,y-b)
  if d<43:body+=f'<path d="M{x:.1f} {y:.1f} L{a:.1f} {b:.1f}" stroke="#e9c77e" stroke-width=".65" opacity=".22"/>'
 body+=f'<circle class="brain-neuron" cx="{x:.1f}" cy="{y:.1f}" r="{1.5 if i%4 else 2.5}" fill="#ffe3a0" style="--n:{i%6}"/>'
body+='</g></g>'
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 65 440 395" fill="none">'+body+'</svg>'
Path('assets/second-brain.svg').write_text(svg)
# Landing uses the same illustration, with six signals arriving at its neurons.
labels=['Demandas','Decisões','Compromissos','Documentos','Indicadores','Memória institucional']
connections=''
for i,label in enumerate(labels):
 side=i//3;y=160+(i%3)*102;x=30 if not side else 610;endx=205 if not side else 435;endY=y+(15 if i%3==0 else -15)
 connections+=f'<g class="brain-connection" style="--delay:{.6+i*.85}s"><text x="{x}" y="{y-17}" text-anchor="{"start" if not side else "end"}">{label}</text><path class="signal-track" d="M{x} {y} H{120 if not side else 520} L{endx} {endY}"/><path class="signal-pulse" pathLength="1" d="M{x} {y} H{120 if not side else 520} L{endx} {endY}"/><circle class="signal-end" cx="{endx}" cy="{endY}" r="5"/></g>'
hero='<div class="hero-art second-brain-hero"><div class="brain-art-heading"><img src="assets/guardiao-symbol.png" alt="Logo do Guardião"/><span>GUARDIÃO<small>INTELIGÊNCIA QUE CONECTA</small></span></div><svg class="hero-brain-svg" viewBox="0 0 640 490" role="img" aria-label="Segundo Cérebro: demandas, decisões, compromissos, documentos, indicadores e memória institucional conectados por neurônios">'+body+connections+'</svg><div class="brain-art-caption"><strong>Segundo Cérebro</strong><span class="brain-connecting">Conectando o que importa.</span><span class="brain-connected">Conexões completas. Uma visão integrada.</span></div></div>'
p=Path('index.html');s=p.read_text();start=s.index('        <div class="hero-art');end=s.index('\n      </div>\n      <div class="container hero-bottom">',start);s=s[:start]+'        '+hero+s[end:];p.write_text(s)
