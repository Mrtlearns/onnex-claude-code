# Traefik Route: cmmc4msp.on-nex.us Landing Page

Add a new router + service for the landing page to the existing cmmc4msp Traefik dynamic config file.

## File to edit (on Traefik host 10.10.30.35)
Find the dynamic config file for cmmc4msp — likely at:
- `/etc/traefik/dynamic/cmmc4msp.yml`
- `/opt/traefik/dynamic/cmmc4msp.yml`
- or wherever the existing `app.cmmc4msp.on-nex.us` route is defined

## Config to add

Under `http.routers:` add:
```yaml
    cmmc4msp-landing:
      rule: "Host(`cmmc4msp.on-nex.us`)"
      entryPoints: ["websecure"]
      service: cmmc4msp-landing
      tls:
        certResolver: letsencrypt
```

Under `http.services:` add:
```yaml
    cmmc4msp-landing:
      loadBalancer:
        servers:
          - url: "http://10.10.110.41:8090"
```

## Verify
After saving, Traefik auto-reloads. Test with:
```bash
curl -sk https://cmmc4msp.on-nex.us/ | head -5
```
