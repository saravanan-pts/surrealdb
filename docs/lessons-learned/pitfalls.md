# Common Pitfalls and How to Avoid Them

## Development Pitfalls

### 1. ❌ Client-Side Node.js Modules
**Pitfall:** Trying to use `pdf-parse` or `fs` in client components
```typescript
// ❌ WRONG - Won't work in browser
import pdfParse from "pdf-parse";
const data = await pdfParse(buffer);
```

**Solution:** Use API routes for server-side processing
```typescript
// ✅ CORRECT - Server-side only
// app/api/process/route.ts
import pdfParse from "pdf-parse";
export async function POST(request: NextRequest) {
  const data = await pdfParse(buffer);
}
```

**Lesson:** Always check if a library works in the browser before using it client-side.

### 2. ❌ Missing Type Definitions
**Pitfall:** Using libraries without TypeScript types
```typescript
// ❌ WRONG - No types
import cola from "cytoscape-cola";
```

**Solution:** Create type declarations
```typescript
// ✅ CORRECT - Type declarations
// types/cytoscape-extensions.d.ts
declare module "cytoscape-cola" {
  import cytoscape from "cytoscape";
  const cola: cytoscape.Ext;
  export = cola;
}
```

**Lesson:** Always check for type definitions or create them.

### 3. ❌ Incorrect API Usage
**Pitfall:** Assuming API method signatures
```typescript
// ❌ WRONG - Incorrect signature
await db.use(namespace, database);
```

**Solution:** Check documentation
```typescript
// ✅ CORRECT - Proper signature
await db.use({ ns: namespace, db: database });
```

**Lesson:** Always verify API documentation, don't assume.

### 4. ❌ State Management Issues
**Pitfall:** Prop drilling and scattered state
```typescript
// ❌ WRONG - Prop drilling
function App() {
  const [entities, setEntities] = useState([]);
  return <Child entities={entities} setEntities={setEntities} />;
}
```

**Solution:** Use state management library
```typescript
// ✅ CORRECT - Centralized state
const { entities, setEntities } = useGraphStore();
```

**Lesson:** Use appropriate state management for complex apps.

### 5. ❌ Missing Error Handling
**Pitfall:** Not handling errors
```typescript
// ❌ WRONG - No error handling
const result = await processFile(file);
```

**Solution:** Always handle errors
```typescript
// ✅ CORRECT - Error handling
try {
  const result = await processFile(file);
} catch (error) {
  console.error("Error:", error);
  toast.error("Failed to process file");
}
```

**Lesson:** Always handle errors, especially async operations.

## Architecture Pitfalls

### 6. ❌ Tight Coupling
**Pitfall:** Direct service imports in components
```typescript
// ❌ WRONG - Tight coupling
import { graphOps } from "@/services/graph-operations";
function Component() {
  const entity = await graphOps.getEntity(id);
}
```

**Solution:** Use hooks or API routes
```typescript
// ✅ CORRECT - Loose coupling
const { getEntity } = useGraph();
const entity = await getEntity(id);
```

**Lesson:** Maintain separation of concerns.

### 7. ❌ No Type Safety
**Pitfall:** Using `any` types
```typescript
// ❌ WRONG - No type safety
function process(data: any) {
  return data.map((item: any) => item.value);
}
```

**Solution:** Use proper types
```typescript
// ✅ CORRECT - Type safety
function process(data: Entity[]): string[] {
  return data.map((item: Entity) => item.label);
}
```

**Lesson:** TypeScript is only useful if you use it properly.

### 8. ❌ Missing Validation
**Pitfall:** Not validating inputs
```typescript
// ❌ WRONG - No validation
function createEntity(data: any) {
  return db.create("entity", data);
}
```

**Solution:** Validate inputs
```typescript
// ✅ CORRECT - Validation
function createEntity(data: unknown) {
  if (!isValidEntity(data)) {
    throw new Error("Invalid entity data");
  }
  return db.create("entity", data);
}
```

**Lesson:** Always validate external inputs.

## Performance Pitfalls

### 9. ❌ Unnecessary Re-renders
**Pitfall:** Not memoizing expensive operations
```typescript
// ❌ WRONG - Recomputes every render
function Component({ data }) {
  const processed = data.map(expensiveOperation);
  return <div>{processed}</div>;
}
```

**Solution:** Memoize expensive operations
```typescript
// ✅ CORRECT - Memoized
function Component({ data }) {
  const processed = useMemo(
    () => data.map(expensiveOperation),
    [data]
  );
  return <div>{processed}</div>;
}
```

**Lesson:** Optimize expensive operations.

### 10. ❌ Large Bundle Sizes
**Pitfall:** Importing entire libraries
```typescript
// ❌ WRONG - Imports entire library
import * as cytoscape from "cytoscape";
```

**Solution:** Import only what's needed
```typescript
// ✅ CORRECT - Tree shaking
import cytoscape from "cytoscape";
```

**Lesson:** Be mindful of bundle size.

## Security Pitfalls

### 11. ❌ Exposing Secrets
**Pitfall:** Using secrets in client code
```typescript
// ❌ WRONG - Secret in client
const API_KEY = "secret-key-123";
```

**Solution:** Keep secrets server-side
```typescript
// ✅ CORRECT - Server-side only
// .env.local
SURREALDB_TOKEN=secret-token

// Server code only
const token = process.env.SURREALDB_TOKEN;
```

**Lesson:** Never expose secrets to the client.

### 12. ❌ No Input Sanitization
**Pitfall:** Using user input directly in queries
```typescript
// ❌ WRONG - SQL injection risk
const query = `SELECT * FROM entity WHERE label = '${userInput}'`;
```

**Solution:** Use parameterized queries
```typescript
// ✅ CORRECT - Parameterized
const query = `SELECT * FROM entity WHERE label = $label`;
await db.query(query, { label: userInput });
```

**Lesson:** Always sanitize and parameterize inputs.

## Testing Pitfalls

### 13. ❌ No Tests
**Pitfall:** Not writing tests
```typescript
// ❌ WRONG - No tests
function processData(data) {
  return data.map(transform);
}
```

**Solution:** Write tests
```typescript
// ✅ CORRECT - With tests
describe('processData', () => {
  it('should transform data correctly', () => {
    const result = processData([1, 2, 3]);
    expect(result).toEqual([2, 4, 6]);
  });
});
```

**Lesson:** Tests catch bugs early.

### 14. ❌ Testing Implementation Details
**Pitfall:** Testing how, not what
```typescript
// ❌ WRONG - Testing implementation
expect(component.state.count).toBe(1);
```

**Solution:** Test behavior
```typescript
// ✅ CORRECT - Testing behavior
expect(screen.getByText("Count: 1")).toBeInTheDocument();
```

**Lesson:** Test behavior, not implementation.

## Deployment Pitfalls

### 15. ❌ Committing Secrets
**Pitfall:** Committing `.env.local`
```bash
# ❌ WRONG - Committed secrets
git add .env.local
git commit -m "Add config"
```

**Solution:** Use `.gitignore`
```bash
# ✅ CORRECT - Ignored
# .gitignore
.env.local
.env*.local
```

**Lesson:** Never commit secrets.

### 16. ❌ No Environment Configuration
**Pitfall:** Hardcoding values
```typescript
// ❌ WRONG - Hardcoded
const API_URL = "https://api.example.com";
```

**Solution:** Use environment variables
```typescript
// ✅ CORRECT - Configurable
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
```

**Lesson:** Make configuration flexible.

### 17. ❌ Environment Variables in Client-Side Code
**Pitfall:** Accessing server-side env vars in client components
```typescript
// ❌ WRONG - process.env.SURREALDB_TOKEN is undefined in client
const token = process.env.SURREALDB_TOKEN; // undefined in browser
```

**Solution:** Use NEXT_PUBLIC_ prefix for client-side access
```typescript
// ✅ CORRECT - NEXT_PUBLIC_ prefix makes it available client-side
const token = process.env.NEXT_PUBLIC_SURREALDB_TOKEN;
```

**Lesson:** In Next.js, only `NEXT_PUBLIC_` prefixed env vars are available in client-side code. Server-side vars (without prefix) are `undefined` in the browser bundle.

### 18. ❌ Cytoscape Initialization Timing
**Pitfall:** Calling Cytoscape methods before initialization completes
```typescript
// ❌ WRONG - Cytoscape not ready yet
useEffect(() => {
  graphRef.current.loadGraphData(entities, relationships);
}, [entities, relationships]);
// Error: "Cannot read properties of null (reading 'isHeadless')"
```

**Solution:** Store pending data and load when ready
```typescript
// ✅ CORRECT - Store data, load when Cytoscape initializes
const pendingDataRef = useRef(null);
loadGraphData: (entities, relationships) => {
  if (!cyRef.current) {
    pendingDataRef.current = { entities, relationships };
    return;
  }
  // Load data...
}
// In initialization: if (pendingDataRef.current) { load it }
```

**Lesson:** Always check if third-party libraries are initialized before calling their methods. Use refs to store pending operations.

### 19. ❌ Webpack Build Cache Corruption
**Pitfall:** Build errors from corrupted webpack cache
```
Error: Cannot find module './276.js'
```

**Solution:** Clear build cache
```bash
rm -rf .next
npm run build
```

**Lesson:** When encountering mysterious build errors, clear the `.next` cache first. Webpack chunk resolution can get corrupted.

### 20. ❌ React Strict Mode Double-Rendering
**Pitfall:** Connection attempts failing due to double-rendering in development
```
Connection failed (attempt 1/5): [object Event]
// Then succeeds on retry
```

**Solution:** Handle gracefully - this is expected in development
```typescript
// ✅ CORRECT - Retry logic handles this
async connect() {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await this.db.connect(url);
      return; // Success
    } catch (error) {
      attempts++;
      await sleep(delay);
    }
  }
}
```

**Lesson:** React Strict Mode double-renders in development. Connection retry logic should handle this gracefully. These errors won't appear in production.

### 21. ❌ TypeScript Errors Only Appearing in CI
**Pitfall:** Code works locally but fails in CI with TypeScript errors
```typescript
// ❌ WRONG - Works in dev, fails in build
let relationship = relationships.find((r) => r.id === edgeId);
relationship = await getRelationship(edgeId); // Type error in CI!
// Error: Type 'Relationship | null' is not assignable to type 'Relationship | undefined'
```

**Solution:** Explicitly type variables with union types
```typescript
// ✅ CORRECT - Works everywhere
let relationship: Relationship | null | undefined = relationships.find((r) => r.id === edgeId);
relationship = await getRelationship(edgeId); // ✅ No error
```

**Lesson:** `next build` runs stricter type checking than `next dev`. Always run `npm run build` locally before pushing. IDE type checking may not catch all issues.

### 22. ❌ Copying Empty/Missing Directories in Dockerfile
**Pitfall:** Docker build fails when copying directories that don't exist or are empty
```dockerfile
# ❌ WRONG - Fails if public/ is empty or missing
COPY --from=builder /app/public ./public
# Error: "/app/public": not found
```

**Solution:** Create directory first, then conditionally copy
```dockerfile
# ✅ CORRECT - Handles empty/missing directories
RUN mkdir -p ./public
RUN --mount=from=builder,source=/app,target=/tmp/builder \
    if [ -d /tmp/builder/public ] && [ -n "$(ls -A /tmp/builder/public 2>/dev/null)" ]; then \
      cp -r /tmp/builder/public/* ./public/; \
    fi
```

**Lesson:** Always handle optional directories in Dockerfiles. Use conditional copying with Docker mounts to avoid build failures.

### 23. ❌ Node Version Mismatch in Docker
**Pitfall:** Using outdated Node version that doesn't meet package requirements
```dockerfile
# ❌ WRONG - Node 18 doesn't support Azure packages
FROM node:18-alpine
# npm warn EBADENGINE: required: { node: '>=20.0.0' }
```

**Solution:** Use Node version that meets all package requirements
```dockerfile
# ✅ CORRECT - Node 20 supports all packages
FROM node:20-alpine
```

**Lesson:** Check package `engines` field and keep Docker base image aligned with requirements. Update regularly for security and compatibility.

### 24. ❌ Missing Standalone Output for Docker
**Pitfall:** Docker build fails or creates large images without standalone output
```javascript
// ❌ WRONG - No standalone output
const nextConfig = {
  reactStrictMode: true,
  // Missing output: 'standalone'
};
```

**Solution:** Enable standalone output for Docker
```javascript
// ✅ CORRECT - Standalone output for Docker
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Required for Docker
};
```

**Lesson:** Always enable `output: 'standalone'` in Next.js config for Docker deployments. This significantly reduces image size and improves startup time.

## Common Mistakes Summary

1. **Using Node.js APIs in browser** → Use API routes
2. **Missing type definitions** → Create or find types
3. **Incorrect API usage** → Check documentation
4. **Poor state management** → Use appropriate tools
5. **No error handling** → Always handle errors
6. **Tight coupling** → Maintain separation
7. **No type safety** → Use TypeScript properly
8. **Missing validation** → Validate inputs
9. **Performance issues** → Optimize properly
10. **Security vulnerabilities** → Follow best practices
11. **No tests** → Write tests
12. **Committing secrets** → Use .gitignore
13. **Client-side env vars** → Use NEXT_PUBLIC_ prefix
14. **Library initialization timing** → Check ready state before use
15. **Build cache issues** → Clear .next directory
16. **React Strict Mode** → Handle double-rendering gracefully
17. **TypeScript CI errors** → Run `npm run build` locally, use explicit types
18. **Docker empty directories** → Create dirs first, conditionally copy
19. **Node version mismatch** → Check package engines, update base image
20. **Missing standalone output** → Enable `output: 'standalone'` for Docker

## Prevention Strategies

1. **Code Reviews**
   - Catch issues early
   - Share knowledge
   - Maintain quality

2. **Linting and Type Checking**
   - Automated checks
   - Consistent code
   - Catch errors

3. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests

4. **Documentation**
   - Clear guidelines
   - Examples
   - Best practices

5. **Tooling**
   - TypeScript
   - ESLint
   - Prettier

## Key Takeaways

1. **Always check library compatibility**
2. **Use TypeScript properly**
3. **Handle errors gracefully**
4. **Validate inputs**
5. **Keep secrets server-side**
6. **Write tests**
7. **Follow best practices**
8. **Review code regularly**
9. **Document decisions**
10. **Learn from mistakes**

