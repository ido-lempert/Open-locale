// Local verification server for the built SPA with API proxy. Not deployment config.
import {createServer,request} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist/apps/web/browser');
createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')){const upstream=request({hostname:'127.0.0.1',port:3000,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>{res.statusCode=502;res.end();});req.pipe(upstream);return;}
 try{const path=new URL(req.url,'http://localhost').pathname;const asset=/\.[a-zA-Z0-9]+$/.test(path);const file=resolve(root,'.'+(asset?path:'/index.html'));if(!file.startsWith(root+'/')){res.statusCode=404;res.end();return;}const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]??'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end();}
}).listen(4200,'127.0.0.1');
