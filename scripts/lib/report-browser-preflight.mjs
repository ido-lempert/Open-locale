// Deliberately narrow supported script shape. New shapes require review.
export function reportBrowserPreflight(label,command,portEnv,source){
 const match=/^(?:python3 scripts\/run-reaped\.py )?node (scripts\/[a-z0-9-]+\.mjs)$/.exec(command);
 if(!match||!portEnv)throw new Error(`Unsupported harness entry: ${label}`);
 if(!/^test:[a-z0-9-]+$/.test(label)||match[1]!==`scripts/${label.slice(5)}-test.mjs`)throw new Error(`Script identity mismatch: ${label}`);
 if(!/^[A-Z][A-Z0-9_]*$/.test(portEnv))throw new Error(`Invalid port mapping: ${label}`);
 const declarations=[...source.matchAll(/\bPG_PORT\s*=\s*Number\(process\.env\.([A-Z][A-Z0-9_]*)\s*\?\?\s*(\d+)\)/g)];
 if(declarations.length!==1||declarations[0][1]!==portEnv)throw new Error(`PostgreSQL override mismatch: ${label}`);
 return [label,match[1],portEnv];
}
