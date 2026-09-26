from math import radians, sin, cos, sqrt, atan2


def haversine_km(lat1, lon1, lat2, lon2):
    """
    Расстояние между двумя точками на сфере (км).
    Это базовая версия для сортировки ленты по расстоянию.
    Полный алгоритм ранжирования (haversine + скор совместимости, unit-тесты)
    реализуется на этапе 1–23 ноября по плану — расширьте эту функцию там.
    """
    R = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c
