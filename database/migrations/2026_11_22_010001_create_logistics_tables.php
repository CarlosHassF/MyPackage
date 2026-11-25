<?php

use App\Enums\SituacaoPacote;
use App\Enums\StatusEntregador;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('centros_logisticos', function (Blueprint $table) {
            $table->id('id_centro_logistico');
            $table->string('nome_centro');
            $table->string('responsavel_centro');
            $table->unsignedInteger('num_entregadores')->default(0);
            $table->timestamps();
        });

        Schema::create('entregadores', function (Blueprint $table) {
            $table->id('id_entregador');
            $table->string('nome_entregador');
            $table->string('num_entregador')->unique();
            $table->enum('status', array_column(StatusEntregador::cases(), 'value'))
                ->default(StatusEntregador::Disponivel->value);
            $table->timestamps();
        });

        Schema::create('pacotes', function (Blueprint $table) {
            $table->id('id_pacote');
            $table->string('cod_rastreio')->unique();
            $table->string('nome_destinatario');
            $table->string('endereco_entrega');
            $table->foreignId('id_origem')
                ->constrained('centros_logisticos', 'id_centro_logistico')
                ->restrictOnDelete();
            $table->foreignId('id_entregador_responsavel')
                ->nullable()
                ->constrained('entregadores', 'id_entregador')
                ->nullOnDelete();
            $table->enum('situacao', array_column(SituacaoPacote::cases(), 'value'))
                ->default(SituacaoPacote::EmSeparacao->value);
            $table->string('cpf_cliente', 11);
            $table->foreign('cpf_cliente')
                ->references('cpf')
                ->on('users')
                ->restrictOnDelete();
            $table->date('data_prevista');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pacotes');
        Schema::dropIfExists('entregadores');
        Schema::dropIfExists('centros_logisticos');
    }
};
