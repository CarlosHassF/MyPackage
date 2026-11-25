<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\CepProviderException;
use App\Http\Controllers\Controller;
use App\Services\CepLookupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CepLookupController extends Controller
{
    public function __invoke(CepLookupService $cepLookup, string $cep): JsonResponse
    {
        $normalizedCep = preg_replace('/^(\d{5})-?(\d{3})$/', '$1$2', $cep) ?? '';
        $validated = Validator::make(
            ['cep' => $normalizedCep],
            ['cep' => ['required', 'regex:/^\d{8}$/']],
        )->validate();

        try {
            $address = $cepLookup->lookup($validated['cep']);
        } catch (CepProviderException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        if ($address === null) {
            return response()->json(['message' => 'CEP não encontrado nas bases consultadas.'], 404);
        }

        return response()->json($address);
    }
}
