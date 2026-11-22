<?php

namespace App\Enums;

enum SituacaoPacote: string
{
    case Entregue = 'entregue';
    case Enviado = 'enviado';
    case EmRota = 'em rota';
    case Devolvido = 'devolvido';
    case EmSeparacao = 'em separação';
}
