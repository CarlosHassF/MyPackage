<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CentroLogisticoController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EntregadorController;
use App\Http\Controllers\Api\PacoteController;
use App\Http\Controllers\Api\RotaPacoteController;
use App\Http\Controllers\Api\UsuarioController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/dashboard', DashboardController::class);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/pacotes/status', [PacoteController::class, 'status']);
    Route::get('/pacotes/{pacote}/rota', RotaPacoteController::class)
        ->middleware('throttle:10,1');
    Route::apiResource('pacotes', PacoteController::class)
        ->parameters(['pacotes' => 'pacote']);

    Route::get('/entregadores/disponiveis', [EntregadorController::class, 'disponiveis']);
    Route::apiResource('entregadores', EntregadorController::class)
        ->parameters(['entregadores' => 'entregador']);

    Route::apiResource('centros-logisticos', CentroLogisticoController::class)
        ->parameters(['centros-logisticos' => 'centro']);
    Route::apiResource('usuarios', UsuarioController::class)
        ->parameters(['usuarios' => 'usuario']);
});
