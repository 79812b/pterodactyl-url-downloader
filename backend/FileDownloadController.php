<?php
// app/Http/Controllers/Api/Client/Servers/FileDownloadController.php

namespace App\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Controller;
use App\Models\Server;
use GuzzleHttp\Client;
use GuzzleHttp\Promise;
use GuzzleHttp\Psr7;
use Webmozart\Assert\Assert;

class FileDownloadController extends Controller
{
    const DOWNLOAD_CACHE_PREFIX = 'server_download:';
    const MAX_SIZE = 2147483648; // 2GB

    public function validateUrl(Request $request)
    {
        $data = $request->validate(['url' => 'required|url']);

        try {
            $client = new Client(['timeout' => 10]);
            $response = $client->head($data['url'], [
                'headers' => ['Range' => 'bytes=0-0'],
            ]);

            $size = $response->getHeader('Content-Range')
                ? (int) explode('/', $response->getHeader('Content-Range')[0])[1]
                : (int) ($response->getHeader('Content-Length')[0] ?? 0);

            return response()->json([
                'size' => $size,
                'max_size' => self::MAX_SIZE,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Could not validate URL: ' . $e->getMessage(),
            ], 400);
        }
    }

    public function download(Request $request)
    {
        $server = $request->attributes->get('server');
        $data = $request->validate([
            'url' => 'required|url',
        ]);

        if (Cache::has($this->getCacheKey($server))) {
            return response()->json(['error' => 'Another download is already in progress'], 409);
        }

        $jobId = uniqid();
        $tempFile = Storage::path("downloads/{$jobId}.tmp");
        $finalPath = $this->resolveFinalPath($server, $data['url']);

        $initialState = [
            'job_id' => $jobId,
            'progress' => 0,
            'total_size' => 0,
            'downloaded' => 0,
            'status' => 'downloading',
            'temp_file' => $tempFile,
            'final_path' => $finalPath,
        ];

        Cache::put($this->getCacheKey($server), $initialState, 3600);

        $client = new Client();
        $client->getAsync($data['url'], [
            'sink' => $tempFile,
            'progress' => function($total, $downloaded) use ($server) {
                if ($total > 0) {
                    $progress = ($downloaded / $total) * 100;
                    Cache::put($this->getCacheKey($server), [
                        'progress' => round($progress, 2),
                        'total_size' => $total,
                        'downloaded' => $downloaded,
                    ], 3600);
                }
            },
        ])->then(
            function() use ($server, $tempFile, $finalPath) {
                rename($tempFile, $finalPath);
                Cache::forget($this->getCacheKey($server));
            },
            function(\Exception $e) use ($server, $tempFile) {
                @unlink($tempFile);
                Cache::put($this->getCacheKey($server), [
                    'status' => 'error',
                    'error' => $e->getMessage(),
                ], 600);
            }
        );

        return response()->json([
            'jobId' => $jobId,
            'size' => $initialState['total_size'],
        ]);
    }

    public function getProgress(Request $request, string $jobId)
    {
        $server = $request->attributes->get('server');
        $data = Cache::get($this->getCacheKey($server), []);

        return response()->json($data);
    }

    public function cancelDownload(Request $request, string $jobId)
    {
        $server = $request->attributes->get('server');
        $data = Cache::get($this->getCacheKey($server));

        if ($data && $data['job_id'] === $jobId) {
            @unlink($data['temp_file']);
            Cache::forget($this->getCacheKey($server));
        }

        return response()->json(['success' => true]);
    }

    private function getCacheKey(Server $server): string
    {
        return self::DOWNLOAD_CACHE_PREFIX . $server->uuid;
    }

    private function resolveFinalPath(Server $server, string $url): string
    {
        $filename = basename(parse_url($url, PHP_URL_PATH));
        $path = rtrim($server->filesystemPath(), '/') . '/' . ltrim($filename, '/');
        
        if (file_exists($path)) {
            throw new \RuntimeException('File already exists');
        }

        return $path;
    }
}
