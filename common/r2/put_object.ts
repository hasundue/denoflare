import { Bytes } from '../bytes.ts';
import { AwsCallBody, AwsCallContext, s3Fetch, throwIfUnexpectedStatus } from './r2.ts';

export type PutObjectOpts = { bucket: string, key: string, body: AwsCallBody, origin: string, region: string, cacheControl?: string, contentDisposition?: string, contentEncoding?: string, contentLanguage?: string, expires?: string, contentMd5?: string, contentType?: string, customMetadata?: Record<string, string> };

export async function putObject(opts: PutObjectOpts, context: AwsCallContext): Promise<void> {
    const { bucket, key, body, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentMd5, contentType, customMetadata } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}/${key}`);
    const headers = new Headers();
    if (typeof cacheControl === 'string') headers.set('cache-control', cacheControl);
    if (typeof contentDisposition === 'string') headers.set('content-disposition', contentDisposition);
    if (typeof contentEncoding === 'string') headers.set('content-encoding', contentEncoding);
    if (typeof contentLanguage === 'string') headers.set('content-language', contentLanguage);
    if (typeof expires === 'string') headers.set('expires', expires);
    if (typeof contentMd5 === 'string') headers.set('content-md5', contentMd5);
    if (typeof contentType === 'string') headers.set('content-type', contentType);
    for (const [ name, value ] of Object.entries(customMetadata || {})) {
        headers.set(`x-amz-meta-${name}`, value);
    }
    if (typeof body !== 'string' && !(body instanceof Bytes)) {
        // required only for stream bodies
        headers.set('content-length', String(body.length))
    }

    const res = await s3Fetch({ method, url, headers, body, region, context });
    await throwIfUnexpectedStatus(res, 200);  // r2 returns 200 with content-length: 0
    const contentLength = res.headers.get('content-length') || '0';
    if (contentLength !== '0') throw new Error(`Expected empty response body to put-object, found: ${await res.text()}`);
}
