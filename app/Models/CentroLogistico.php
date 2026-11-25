<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CentroLogistico extends Model
{
    use HasFactory;

    protected $table = 'centros_logisticos';

    protected $primaryKey = 'id_centro_logistico';

    protected $fillable = [
        'nome_centro',
        'responsavel_centro',
        'endereco_centro',
        'num_entregadores',
    ];

    protected function casts(): array
    {
        return [
            'num_entregadores' => 'integer',
        ];
    }

    public function pacotes(): HasMany
    {
        return $this->hasMany(Pacote::class, 'id_origem', 'id_centro_logistico');
    }
}
