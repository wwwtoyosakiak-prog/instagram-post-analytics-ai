<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$dataDir = __DIR__ . '/data';
$dataFile = $dataDir . '/app-data.json';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function empty_store(): array
{
    return [
        'accounts' => [],
        'posts' => [],
        'updatedAt' => null,
    ];
}

function read_store(string $file): array
{
    if (!file_exists($file)) {
        return empty_store();
    }

    $raw = file_get_contents($file);
    $decoded = json_decode($raw ?: '', true);

    if (!is_array($decoded)) {
        return empty_store();
    }

    return [
        'accounts' => is_array($decoded['accounts'] ?? null) ? $decoded['accounts'] : [],
        'posts' => is_array($decoded['posts'] ?? null) ? $decoded['posts'] : [],
        'updatedAt' => $decoded['updatedAt'] ?? null,
    ];
}

if ($path === '/api/health' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response([
        'ok' => true,
        'message' => 'PHP backend is running',
        'phpVersion' => PHP_VERSION,
        'time' => date(DATE_ATOM),
    ]);
}

if ($path === '/api/data' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    json_response(read_store($dataFile));
}

if ($path === '/api/data' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = file_get_contents('php://input');
    $input = json_decode($body ?: '', true);

    if (!is_array($input)) {
        json_response([
            'ok' => false,
            'message' => 'Invalid JSON body',
        ], 400);
    }

    $payload = [
        'accounts' => is_array($input['accounts'] ?? null) ? $input['accounts'] : [],
        'posts' => is_array($input['posts'] ?? null) ? $input['posts'] : [],
        'updatedAt' => date(DATE_ATOM),
    ];

    file_put_contents($dataFile, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    json_response([
        'ok' => true,
        'message' => 'Saved',
        'counts' => [
            'accounts' => count($payload['accounts']),
            'posts' => count($payload['posts']),
        ],
        'updatedAt' => $payload['updatedAt'],
    ]);
}

json_response([
    'ok' => false,
    'message' => 'Not found',
], 404);
