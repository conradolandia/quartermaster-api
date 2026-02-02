from unittest.mock import MagicMock, patch

from app.backend_pre_start import init, logger


def test_init_successful_connection() -> None:
    engine_mock = MagicMock()

    session_mock = MagicMock()
    session_mock.exec.return_value = MagicMock()
    session_mock.commit.return_value = None
    session_mock.__enter__.return_value = session_mock
    session_mock.__exit__.return_value = None

    with (
        patch("app.backend_pre_start.Session", return_value=session_mock),
        patch.object(logger, "info"),
        patch.object(logger, "error"),
        patch.object(logger, "warn"),
    ):
        try:
            init(engine_mock)
            connection_successful = True
        except Exception:
            connection_successful = False

        assert (
            connection_successful
        ), "The database connection should be successful and not raise an exception."

        session_mock.exec.assert_called_once()
        (stmt,) = session_mock.exec.call_args[0]
        assert type(stmt).__name__ == "SelectOfScalar"
