<?php

namespace App\Enums;

enum StatusEntregador: string
{
    case EmRota = 'em rota';
    case Disponivel = 'disponivel';
    case Indisponivel = 'indisponivel';
}
