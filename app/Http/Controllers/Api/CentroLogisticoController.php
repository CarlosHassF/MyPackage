<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CentroLogistico;
use App\Models\Pacote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CentroLogisticoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(CentroLogistico::query()->latest('id_centro_logistico')->paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nome_centro' => ['required', 'string', 'max:255'],
            'responsavel_centro' => ['required', 'string', 'max:255'],
            'endereco_centro' => ['nullable', 'string', 'max:255'],
            'num_entregadores' => ['required', 'integer', 'min:0'],
        ]);

        return response()->json(CentroLogistico::create($data), 201);
    }

    public function show(int $centro): JsonResponse
    {
        return response()->json(CentroLogistico::query()->findOrFail($centro));
    }

    public function update(Request $request, int $centro): JsonResponse
    {
        $logistico = CentroLogistico::query()->findOrFail($centro);
        $data = $request->validate([
            'nome_centro' => ['sometimes', 'required', 'string', 'max:255'],
            'responsavel_centro' => ['sometimes', 'required', 'string', 'max:255'],
            'endereco_centro' => ['sometimes', 'nullable', 'string', 'max:255'],
            'num_entregadores' => ['sometimes', 'required', 'integer', 'min:0'],
        ]);

        $logistico->update($data);

        return response()->json($logistico->refresh());
    }

    public function destroy(int $centro): JsonResponse
    {
        $logistico = CentroLogistico::query()->findOrFail($centro);

        if (Pacote::query()->where('id_origem', $logistico->id_centro_logistico)->exists()) {
            return response()->json([
                'message' => 'Não é possível excluir um centro logístico que possui pacotes cadastrados.',
            ], 409);
        }

        $logistico->delete();

        return response()->json(null, 204);
    }
}
