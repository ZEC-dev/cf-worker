/**
 * Cloudflare Worker: Maven/Gradle 多仓库代理
 */

// 用 Record<string, string> 声明，允许用任意字符串索引
const REPOSITORIES: Record<string, string> = {
	central: 'https://repo.maven.apache.org/maven2',
	google: 'https://maven.google.com',
	jitpack: 'https://jitpack.io',
	plugins: 'https://plugins.gradle.org/m2',
	'spring-milestones': 'https://repo.spring.io/milestone',
	'spring-snapshots': 'https://repo.spring.io/snapshot',
	papermc: 'https://repo.papermc.io/repository/maven-public/'
};

export default {
	// 显式标注参数类型，消除 7006
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const pathSegments = pathname.split('/');

		if (pathSegments.length < 2 || !pathSegments[1]) {
			return new Response(
				'请指定仓库前缀。例如: /central/group/artifact/version/file\n' + '支持的仓库: ' + Object.keys(REPOSITORIES).join(', '),
				{ status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
			);
		}

		const repoKey = pathSegments[1];
		const remainingPath = pathSegments.slice(2).join('/');

		// 现在 repoKey 是 string，REPOSITORIES 有索引签名，不再报 7053
		const upstreamBase = REPOSITORIES[repoKey];

		if (!upstreamBase) {
			return new Response(`未知的仓库前缀: "${repoKey}"。\n` + `请使用以下之一: ${Object.keys(REPOSITORIES).join(', ')}`, {
				status: 404,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}

		const upstreamUrl = new URL(remainingPath, upstreamBase);
		upstreamUrl.search = url.search;

		const modifiedRequest = new Request(upstreamUrl.toString(), {
			method: request.method,
			headers: request.headers,
			body: request.body,
			redirect: 'manual',
		});

		let upstreamResponse: Response;
		try {
			upstreamResponse = await fetch(modifiedRequest);
		} catch (err) {
			// err 是 unknown，先判断类型
			const message = err instanceof Error ? err.message : String(err);
			return new Response(`代理请求失败: ${message}\n目标地址: ${upstreamUrl.toString()}`, {
				status: 502,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}

		return new Response(upstreamResponse.body, {
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: upstreamResponse.headers,
		});
	},
};
