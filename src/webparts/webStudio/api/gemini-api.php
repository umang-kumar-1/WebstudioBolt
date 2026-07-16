<?php

ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 3600");
header("Content-Type: application/json; charset=UTF-8");

if (!function_exists('curl_init')) {
    echo json_encode(["success" => false, "error" => "CURL extension is not enabled on this server."]);
    exit;
}

if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
            continue;
        }
        list($key, $value) = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
        if (function_exists('putenv')) {
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed"]);
    exit;
}

$lambdaUrl = trim((string)($_ENV['AWS_LAMBDA_DOCUMENT_SUMMARY_URL'] ?? getenv('AWS_LAMBDA_DOCUMENT_SUMMARY_URL') ?: ''));
if ($lambdaUrl === '') {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "AWS_LAMBDA_DOCUMENT_SUMMARY_URL is not configured."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid JSON body."]);
    exit;
}

$type = $input['type'] ?? '';

if ($type === "theme") {
    $prompt = trim((string)($input['prompt'] ?? ''));
    $fullPrompt = trim((string)($input['fullPrompt'] ?? ''));
    if ($fullPrompt !== '') {
        $query = $fullPrompt;
    } else {
        $query = "You are an expert UI/UX designer and CSS architect.\n"
            . "Return ONLY one complete JSON object containing ALL website theme CSS variables.\n"
            . "Rules: include every theme token (brand colors, text, links, backgrounds, buttons, typography, sidebar, header, footer, status, borders, icons); use hex colors (#rrggbb) only; never use var(...); ensure accessible contrast; match fonts and border radii to the mood.\n"
            . "USER MOOD / STYLE REQUEST:\n\"$prompt\"";
    }

} elseif ($type === "translate") {
    $text = $input['text'] ?? '';
    $lang = $input['targetLang'] ?? '';
    $preserveFormatting = !empty($input['preserveFormatting']);
    $sourceFormat = strtolower(trim($input['sourceFormat'] ?? 'text'));

    if ($preserveFormatting && $sourceFormat === 'html') {
        $query = "Translate the following HTML content into $lang.\n"
            . "IMPORTANT RULES:\n"
            . "1) Keep all HTML tags, attributes, structure, and order exactly the same.\n"
            . "2) Translate only user-visible text.\n"
            . "3) Do not add explanations, markdown, wrappers, or extra characters.\n"
            . "4) Return ONLY valid translated HTML.\n\n"
            . "HTML:\n$text";
    } else {
        $query = "Translate into $lang. Preserve the original line breaks and text structure.\n"
            . "Return ONLY the translated text, no explanations.\n\nText:\n$text";
    }

} else {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid type"]);
    exit;
}

$inner = [
    "mode" => "GENERAL_AI",
    "query" => $query,
];

$headers = [
    "Content-Type: application/json",
    "Accept: application/json",
];

$apiKey = trim((string)($_ENV['AWS_LAMBDA_API_KEY'] ?? getenv('AWS_LAMBDA_API_KEY') ?: ''));
if ($apiKey !== '') {
    $headers[] = "Authorization: Bearer $apiKey";
}

$ch = curl_init($lambdaUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode(["body" => json_encode($inner)]),
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $response === '') {
    http_response_code(502);
    echo json_encode([
        "success" => false,
        "error" => "AWS Lambda request failed.",
        "details" => $error ?: "Empty response",
    ]);
    exit;
}

$data = json_decode($response, true);
if (!is_array($data)) {
    http_response_code($httpCode >= 400 ? $httpCode : 502);
    echo json_encode([
        "success" => false,
        "error" => $httpCode >= 400
            ? "AWS Lambda request failed ($httpCode)."
            : "AWS Lambda returned a non-JSON response.",
        "details" => $response,
    ]);
    exit;
}

if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code($httpCode);
    echo json_encode([
        "success" => false,
        "error" => $data['message'] ?? $data['error'] ?? "AWS Lambda request failed ($httpCode).",
        "details" => $data,
    ]);
    exit;
}

if (($data['success'] ?? null) === false) {
    http_response_code(502);
    echo json_encode([
        "success" => false,
        "error" => $data['message'] ?? $data['error'] ?? "AWS Lambda reported success: false.",
        "details" => $data,
    ]);
    exit;
}

http_response_code(200);
echo json_encode($data);
