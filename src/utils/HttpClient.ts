import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';

export interface HttpRequestOptions {
  token?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  maxRedirects?: number;
  maxResponseBytes?: number;
  proxyUrl?: string;
}

/**
 * 统一 HTTP/HTTPS 网络请求客户端
 * 提供原生超时控制、30x 自动重定向追踪、Token 鉴权注入与异常转换
 */
export class HttpClient {
  private static readonly DEFAULT_TIMEOUT_MS = 15000;
  private static readonly MAX_REDIRECTS = 5;
  private static readonly MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
  private static proxyUrl = '';

  public static setProxyUrl(proxyUrl?: string): void {
    if (proxyUrl) {
      const parsed = new URL(proxyUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Proxy URL must use http:// or https://');
      }
      this.proxyUrl = parsed.toString();
    } else {
      this.proxyUrl = '';
    }
  }

  /**
   * 执行 HTTP/HTTPS GET 请求并返回文本
   */
  public static async get(urlStr: string, options?: HttpRequestOptions): Promise<string> {
    const buf = await this.getBuffer(urlStr, options);
    return buf.toString('utf-8');
  }

  /**
   * 执行 HTTP/HTTPS GET 请求并返回原始 Buffer
   */
  public static async getBuffer(urlStr: string, options?: HttpRequestOptions): Promise<Buffer> {
    const timeoutMs = options?.timeoutMs || HttpClient.DEFAULT_TIMEOUT_MS;
    const maxRedirects = options?.maxRedirects ?? HttpClient.MAX_REDIRECTS;
    const maxResponseBytes = options?.maxResponseBytes ?? HttpClient.MAX_RESPONSE_BYTES;

    return new Promise<Buffer>((resolve, reject) => {
      let url: URL;
      try {
        url = new URL(urlStr);
      } catch (err: any) {
        return reject(new Error(`Invalid URL: ${urlStr} (${err.message})`));
      }

      const client = url.protocol === 'http:' ? http : https;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return reject(new Error(`Unsupported URL protocol: ${url.protocol}`));
      }
      const proxyUrl = options?.proxyUrl ?? HttpClient.proxyUrl;
      const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
      const headers: Record<string, string> = {
        'User-Agent': 'PluginHub-Extension',
        Accept: '*/*',
        ...(options?.headers || {})
      };

      if (options?.token) {
        headers['Authorization'] = `token ${options.token}`;
      }

      const req = client.get(
        urlStr,
        {
          headers,
          timeout: timeoutMs,
          agent
        },
        (res) => {
          // Handle HTTP redirects (301, 302, 307, 308)
          if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            if (maxRedirects <= 0) {
              return reject(new Error(`Too many redirects when requesting ${urlStr}`));
            }
            const nextLocation = new URL(res.headers.location, urlStr).toString();
            const sameOrigin = new URL(nextLocation).origin === url.origin;
            res.resume();
            return HttpClient.getBuffer(nextLocation, {
              ...options,
              token: sameOrigin ? options?.token : undefined,
              maxRedirects: maxRedirects - 1
            })
              .then(resolve)
              .catch(reject);
          }

          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            res.resume();
            return reject(new Error(`HTTP request failed with status ${res.statusCode}: ${res.statusMessage} (${urlStr})`));
          }

          const chunks: Buffer[] = [];
          let receivedBytes = 0;
          res.on('data', (chunk) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            receivedBytes += buffer.length;
            if (receivedBytes > maxResponseBytes) {
              req.destroy(new Error(`Response exceeded ${maxResponseBytes} bytes: ${urlStr}`));
              return;
            }
            chunks.push(buffer);
          });
          res.on('end', () => {
            resolve(Buffer.concat(chunks));
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`HTTP request timed out after ${timeoutMs}ms: ${urlStr}`));
      });

      req.on('error', (err) => {
        reject(new Error(`Network error requesting ${urlStr}: ${err.message}`));
      });
    });
  }
}
