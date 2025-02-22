"""Noop license middleware"""


async def get_license_status() -> bool:
    """Always return true"""
    return True


def plus_features_enabled() -> bool:
    """Always return false"""
    return False
