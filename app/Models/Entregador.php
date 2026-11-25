<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Entregador extends Model
{
    use HasFactory;

    protected $table = 'entregadores';

    protected $primaryKey = 'id_entregador';

    protected $fillable = [
        'nome_entregador',
        'num_entregador',
        'status',
    ];

    public function pacotes(): HasMany
    {
        return $this->hasMany(Pacote::class, 'id_entregador_responsavel', 'id_entregador');
    }
}
