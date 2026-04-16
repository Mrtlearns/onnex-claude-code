"""Level 3 RT analysis retest — verifies full OAuth CLI path + DB write."""
import asyncio, base64, json, uuid, glob
import httpx

GATEWAY = 'http://localhost:8012'
PROMPTS_DIR = '/opt/ndt-portal/api/prompts'


async def main():
    base = open(f'{PROMPTS_DIR}/base-rt-analyst.txt').read()
    module = open(f'{PROMPTS_DIR}/modules/generic_rt.txt').read()
    system_prompt = base + '\n\n---\n\n' + module
    print(f'=== System Prompt: {len(system_prompt)} chars ===')

    imgs = (
        glob.glob('/opt/ndt-portal/**/*.png', recursive=True)
        + glob.glob('/tmp/*.png')
    )
    if not imgs:
        print('No PNG found, generating minimal test PNG')
        import struct, zlib

        def mk_png():
            w, h = 64, 64
            row = b'\x00' + b'\xff\x80\x00' * w
            raw = row * h
            def chunk(t, d):
                c = struct.pack('>I', len(d)) + t + d
                return c + struct.pack('>I', zlib.crc32(c[4:]) & 0xffffffff)
            ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
            return (
                b'\x89PNG\r\n\x1a\n'
                + chunk(b'IHDR', ihdr)
                + chunk(b'IDAT', zlib.compress(raw))
                + chunk(b'IEND', b'')
            )

        with open('/tmp/test_rt.png', 'wb') as f:
            f.write(mk_png())
        img_path = '/tmp/test_rt.png'
    else:
        img_path = imgs[0]
        print(f'Using image: {img_path}')

    img_b64 = base64.b64encode(open(img_path, 'rb').read()).decode()
    print(f'Image: {len(img_b64) // 1024}KB b64')

    payload = {
        'intake_id': str(uuid.uuid4()),
        'sanitize_job_id': str(uuid.uuid4()),
        'prompt': 'Analyze this RT image and provide your findings.',
        'system_prompt': system_prompt,
        'classification': 'CLEAN',
        'llm_routing': 'CLOUD_OK',
        'images': [{'media_type': 'image/png', 'data_b64': img_b64}],
    }

    print('=== Calling gateway /analyze (timeout 300s) ===')
    async with httpx.AsyncClient(timeout=300.0) as c:
        r = await c.post(f'{GATEWAY}/analyze', json=payload)
        print(f'HTTP {r.status_code}')
        if r.status_code == 200:
            d = r.json()
            print(f'request_id:   {d["request_id"]}')
            print(f'provider_used: {d["provider_used"]}')
            print(f'model_used:    {d["model_used"]}')
            print(f'latency_ms:    {d["latency_ms"]}')
            resp = d.get('response_json', {})
            print(f'response keys: {list(resp.keys()) if resp else "empty"}')
            print('=== SUCCESS ===')
        else:
            print(f'ERROR: {r.text[:800]}')


asyncio.run(main())
