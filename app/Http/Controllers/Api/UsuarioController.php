<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UsuarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(User::query()->latest('id')->paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        return response()->json(User::create($data), 201);
    }

    public function show(int $usuario): JsonResponse
    {
        return response()->json(User::query()->findOrFail($usuario));
    }

    public function update(Request $request, int $usuario): JsonResponse
    {
        $user = User::query()->findOrFail($usuario);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'password' => ['sometimes', 'required', 'string', 'min:8'],
        ]);

        $user->update($data);

        return response()->json($user->refresh());
    }

    public function destroy(Request $request, int $usuario): JsonResponse
    {
        $user = User::query()->findOrFail($usuario);

        if ($request->user()->is($user)) {
            return response()->json([
                'message' => 'Você não pode excluir o seu próprio acesso.',
            ], 409);
        }

        $user->tokens()->delete();
        $user->delete();

        return response()->json(null, 204);
    }
}