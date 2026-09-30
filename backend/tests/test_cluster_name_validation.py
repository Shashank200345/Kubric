from app.insforge_client import _is_cluster_name

def test_is_cluster_name_valid():
    assert _is_cluster_name("my-cluster") is True
    assert _is_cluster_name("prod_cluster_1") is True
    assert _is_cluster_name("k8s.dev.local") is True
    assert _is_cluster_name("cluster-123") is True

def test_is_cluster_name_invalid_leading_dash():
    assert _is_cluster_name("-n") is False
    assert _is_cluster_name("--all") is False
    assert _is_cluster_name("-context") is False

def test_is_cluster_name_invalid_characters_and_types():
    assert _is_cluster_name("cluster; drop table") is False
    assert _is_cluster_name("cluster name") is False
    assert _is_cluster_name(None) is False
    assert _is_cluster_name(123) is False
    assert _is_cluster_name("") is False
