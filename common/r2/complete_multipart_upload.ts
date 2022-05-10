import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus } from './r2.ts';

export type CompleteMultipartUploadOpts = { bucket: string, key: string, uploadId: string, parts: CompletedPart[], origin: string, region: string };

export async function completeMultipartUpload(opts: CompleteMultipartUploadOpts, context: AwsCallContext): Promise<CompleteMultipartUploadResult> {
    const { bucket, key, uploadId, parts, origin, region } = opts;
    if (parts.length === 0) throw new Error(`Must include at least one part`);

    const method = 'POST';
    const url = new URL(`${origin}/${bucket}/${key}`);
    url.searchParams.set('uploadId', uploadId);

    const body = computePayload(parts);
    if (R2.DEBUG) console.log(body);

    const res = await s3Fetch({ method, url, body, region, context });
    await throwIfUnexpectedStatus(res, 200);
    
    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseCompleteMultipartUploadResultXml(xml);
}

export interface CompletedPart {
    readonly partNumber: number;
    readonly etag: string;
    readonly checksumCrc32?: string;
    readonly checksumCrc32C?: string;
    readonly checksumSha1?: string;
    readonly checksumSha256?: string;
}

export interface CompleteMultipartUploadResult {
    readonly location: string;
    readonly bucket: string;
    readonly key: string;
    readonly etag: string;
    readonly checksumCrc32?: string;
    readonly checksumCrc32C?: string;
    readonly checksumSha1?: string;
    readonly checksumSha256?: string;
}

//

function parseCompleteMultipartUploadResultXml(xml: ExtendedXmlNode): CompleteMultipartUploadResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseCompleteMultipartUploadResult(doc.getKnownElement('CompleteMultipartUploadResult'));
    doc.check();
    return rt;
}

function parseCompleteMultipartUploadResult(element: KnownElement): CompleteMultipartUploadResult {
    const location = element.getElementText('Location');
    const bucket = element.getElementText('Bucket');
    const key = element.getElementText('Key');
    const etag = element.getElementText('ETag');
    const checksumCrc32 = element.getOptionalElementText('ChecksumCRC32');
    const checksumCrc32C = element.getOptionalElementText('ChecksumCRC32C');
    const checksumSha1 = element.getOptionalElementText('ChecksumSHA1');
    const checksumSha256 = element.getOptionalElementText('ChecksumSHA256>');
    element.check();
    return { location, bucket, key, etag, checksumCrc32, checksumCrc32C, checksumSha1, checksumSha256 };
}

const computePayload = (parts: CompletedPart[]) => `<?xml version="1.0" encoding="UTF-8"?>
<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${parts.map(computePartElement).join('')}
</CompleteMultipartUpload>`;

const computePartElement = (part: CompletedPart) =>`
  <Part>
    <PartNumber>${part.partNumber}</PartNumber>
    <ETag>${part.etag}</ETag>
${part.checksumCrc32 ? `   <ChecksumCRC32>${part.checksumCrc32}</ChecksumCRC32>` : ''}
${part.checksumCrc32C ? `   <ChecksumCRC32C>${part.checksumCrc32C}</ChecksumCRC32C>` : ''}
${part.checksumSha1 ? `   <ChecksumSHA1>${part.checksumSha1}</ChecksumSHA1>` : ''}
${part.checksumSha256 ? `   <ChecksumSHA256>${part.checksumSha256}</ChecksumSHA256>` : ''}
  </Part>`;
