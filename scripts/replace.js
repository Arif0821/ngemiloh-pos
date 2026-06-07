const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.svelte') || p.endsWith('.ts')) {
      if (p.includes('api.client.ts') || p.includes('+layout.ts') || p.includes('db.ts')) continue;
      
      let content = fs.readFileSync(p, 'utf8');
      const orig = content;
      
      // Replace fetch calls
      if (content.includes('fetch(`/api')) {
          content = content.replace(/fetch\(\`/g, 'api.request(`');
      }
      if (content.includes('fetch(url')) {
          content = content.replace(/fetch\(url/g, 'api.request(url');
      }

      if (content !== orig && content.includes('api.request')) {
         // Add import if needed
         if (!content.includes('import { api }')) {
            if (p.endsWith('.svelte')) {
               content = content.replace('<script lang="ts">', '<script lang="ts">\n  import { api } from \'$lib/services/api.client\';');
               content = content.replace('<script>', '<script>\n  import { api } from \'$lib/services/api.client\';');
            } else {
               content = 'import { api } from \'$lib/services/api.client\';\n' + content;
            }
         }
         fs.writeFileSync(p, content);
         console.log('Updated ' + p);
      }
    }
  }
}

walk('C:/POS_Nabil/frontend/src');
