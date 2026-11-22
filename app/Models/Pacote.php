<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Pacote extends Model
{
    use HasFactory;

    protected $table = 'pacotes';

    protected $primaryKey = 'id_pacote';

    protected $fillable = [
        'cod_rastreio',
        'nome_destinatario',
        'endereco_entrega',
        'id_origem',
        'id_entregador_responsavel',
        'situacao',
        'cpf_cliente',
        'data_prevista',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'data_prevista' => 'date:Y-m-d',
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    public function origem(): BelongsTo
    {
        return $this->belongsTo(CentroLogistico::class, 'id_origem', 'id_centro_logistico');
    }

    public function entregadorResponsavel(): BelongsTo
    {
        return $this->belongsTo(Entregador::class, 'id_entregador_responsavel', 'id_entregador');
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cpf_cliente', 'cpf');
    }
}
