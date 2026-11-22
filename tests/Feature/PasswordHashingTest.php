<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PasswordHashingTest extends TestCase
{
    public function test_passwords_use_bcrypt(): void
    {
        $hash = Hash::make('secret-password');

        $this->assertSame('bcrypt', Hash::info($hash)['algoName']);
        $this->assertTrue(Hash::check('secret-password', $hash));
    }

    public function test_user_passwords_are_hashed_when_assigned(): void
    {
        $user = new User;
        $user->password = 'secret-password';

        $this->assertNotSame('secret-password', $user->getAttributes()['password']);
        $this->assertTrue(Hash::check('secret-password', $user->getAttributes()['password']));
    }
}
