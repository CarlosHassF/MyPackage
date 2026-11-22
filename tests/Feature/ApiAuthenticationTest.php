<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiAuthenticationTest extends TestCase
{
    public function test_user_api_route_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }
}
