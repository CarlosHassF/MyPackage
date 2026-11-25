<?php

return [
    'nominatim_url' => env('NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search'),
    'osrm_url' => env('OSRM_URL', 'https://router.project-osrm.org/route/v1/driving'),
    'user_agent' => sprintf(
        '%s/1.0 (+%s%s)',
        env('APP_NAME', 'MyPackage'),
        env('APP_URL', 'http://localhost'),
        env('MAPS_CONTACT_EMAIL') ? '; '.env('MAPS_CONTACT_EMAIL') : '',
    ),
];
