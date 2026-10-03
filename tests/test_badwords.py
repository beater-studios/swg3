from swg3.gen3 import badwords


def test_classification():
    assert badwords.classify("^bv$") == ("bv", "boundary")
    assert badwords.classify(".*xxx.*") == ("xxx", "strong")      # confirmed on the Switch
    assert badwords.classify(".*ass.*") == ("ass", "boundary")    # manual override
    assert badwords.parse_pattern("^jod.*") == ("jod", "prefix")
    boundary, strong = badwords.terms()
    assert len(boundary) + len(strong) > 4000


def test_boundary_terms():
    assert badwords.blocked("ass")
    assert badwords.blocked("12ass34")        # digits do not protect
    assert badwords.blocked("a s s")          # single letters recombine
    assert not badwords.blocked("mass")
    assert not badwords.blocked("xassx")
    assert badwords.blocked("bj") and not badwords.blocked("ebj")


def test_strong_terms():
    assert badwords.blocked("xshitx")
    assert badwords.blocked("Rx5XxlIk")       # "xxx" with a digit in the middle, rejected on the Switch
    assert "xxx" in badwords.matches("Rx5XxlIk")


def test_clean_names():
    for name in ("FM.oZ.Bn", "D3n,E?q", "AAQU.o", "BULBASAUR", "RED"):
        assert not badwords.blocked(name), name
