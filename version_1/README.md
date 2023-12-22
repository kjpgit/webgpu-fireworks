# WebGPU Fireworks Demo

## Building

```
npm ci
make build
make serve
```

Browse to http://localhost:3000

IMPORTANT: Go to chrome://flags and add http://localhost:3000 to "Insecure
origins trusted as source", then click Enabled, then click Relaunch.  Otherwise, you must
host it on HTTPS to get WebGPU access.
