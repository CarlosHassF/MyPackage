<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('centros_logisticos', function (Blueprint $table) {
            $table->string('endereco_centro')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('centros_logisticos', function (Blueprint $table) {
            $table->dropColumn('endereco_centro');
        });
    }
};
